#!/usr/bin/env python3
"""
Code Review Agent — fetches a PR diff and posts a structured review as a PR comment.

Uses OpenAI Codex with this project's stack standards (copilot-instructions.md) as the
review rubric. Covers: correctness, security, TypeScript/Python conventions,
test coverage, Zod/Pydantic validation, and error handling.

Usage:
  uv run --with openai scripts/code_review_agent.py \
    --repo OWNER/REPO --pr NUMBER --output /tmp/review.md

Required environment variables:
  OPENAI_API_KEY
  GH_TOKEN (GitHub token with repo read access)
"""

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
GH_TOKEN = os.environ["GH_TOKEN"]

ROOT = Path(__file__).parent.parent
COPILOT_INSTRUCTIONS_PATH = ROOT / ".github" / "copilot-instructions.md"

REVIEW_SYSTEM_PROMPT = """You are a senior code reviewer for a TypeScript + Python investment-helper project.

Your review must be structured, specific, and actionable. Flag real problems — not style
preferences. Every finding must cite the file and line range.

{stack_context}

## Review output format

Produce a Markdown comment with these sections. Omit a section if nothing to report.

### Summary
One paragraph: what the PR does, overall quality signal (ship / ship with fixes / needs rework).

### Critical (must fix before merge)
Numbered list. Format: `**file:line** — problem. Suggested fix.`
Include: logic bugs, security issues (injection, secrets, missing auth), data loss risk,
broken contracts (Zod/Pydantic schemas violated), DB writes outside transactions.

### Warnings (should fix)
Same format. Include: missing error handling at system boundaries, unchecked external
API responses, TypeScript `any` usage, Python `dict` where Pydantic model required,
missing test coverage for new code paths, index missing for new query patterns.

### Suggestions (optional improvements)
Lightweight items that improve clarity or maintainability but don't block merge.

### Checklist
```
- [ ] No secrets or tokens in code
- [ ] All external inputs validated (Zod / Pydantic)
- [ ] DB writes inside transaction scope
- [ ] New code paths have unit tests
- [ ] TypeScript: no `any`, strict mode passes
- [ ] Python: mypy / ruff clean
- [ ] Conventional Commit message
```
Mark [ ] → [x] for items that pass. Leave unchecked for items that fail or can't be verified.

Be direct. Skip praise. If the PR is clean, say so and ship it.
"""


def gh_api(path: str, accept: str = "application/vnd.github+json") -> dict | str:
    url = f"https://api.github.com{path}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {GH_TOKEN}",
            "Accept": accept,
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(req) as resp:
        raw = resp.read()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw.decode()


def fetch_pr_meta(repo: str, pr: int) -> dict:
    return gh_api(f"/repos/{repo}/pulls/{pr}")


def fetch_pr_diff(repo: str, pr: int) -> str:
    return gh_api(f"/repos/{repo}/pulls/{pr}", accept="application/vnd.github.v3.diff")


def call_codex(system: str, user: str) -> str:
    import openai
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    resp = client.chat.completions.create(
        model="o4-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_completion_tokens=4096,
    )
    return resp.choices[0].message.content


def post_pr_comment(repo: str, pr: int, body: str) -> None:
    url = f"https://api.github.com/repos/{repo}/issues/{pr}/comments"
    data = json.dumps({"body": body}).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {GH_TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="POST",
    )
    with urllib.request.urlopen(req):
        pass


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True, help="owner/repo")
    parser.add_argument("--pr", required=True, type=int, help="PR number")
    parser.add_argument("--output", help="Optional path to write review Markdown")
    args = parser.parse_args()

    print(f"Fetching PR #{args.pr} from {args.repo} …")
    meta = fetch_pr_meta(args.repo, args.pr)
    diff = fetch_pr_diff(args.repo, args.pr)

    title = meta.get("title", "")
    body = meta.get("body", "") or ""
    base = meta.get("base", {}).get("ref", "dev")
    head = meta.get("head", {}).get("ref", "")
    changed_files = meta.get("changed_files", 0)

    print(f"  Title        : {title}")
    print(f"  Branch       : {head} → {base}")
    print(f"  Changed files: {changed_files}")
    print(f"  Diff size    : {len(diff)} chars")

    stack_context = ""
    if COPILOT_INSTRUCTIONS_PATH.exists():
        stack_context = f"## Project stack standards\n\n{COPILOT_INSTRUCTIONS_PATH.read_text()}"

    system = REVIEW_SYSTEM_PROMPT.format(stack_context=stack_context)

    # Truncate diff if very large to stay within context limits
    max_diff = 60_000
    diff_truncated = diff[:max_diff] + "\n\n[... diff truncated ...]" if len(diff) > max_diff else diff

    user = f"""PR #{args.pr}: {title}
Branch: {head} → {base}
Description: {body[:500] if body else "(none)"}

--- DIFF ---
{diff_truncated}
"""

    print("Calling Codex (o4-mini) for code review …")
    review = call_codex(system, user)

    header = f"## Code Review — PR #{args.pr}\n\n> Automated review by [Codex code reviewer](https://github.com/{args.repo}/actions)\n\n"
    full_review = header + review

    print("Posting review comment …")
    post_pr_comment(args.repo, args.pr, full_review)
    print("Review posted.")

    if args.output:
        Path(args.output).write_text(full_review)
        print(f"Review saved to {args.output}")


if __name__ == "__main__":
    main()
