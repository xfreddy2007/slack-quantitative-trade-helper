#!/usr/bin/env python3
"""
Fix Unresolved Agent — checks a PR for unresolved review threads and creates or
updates a GitHub issue assigned to @copilot to fix them.

Loops naturally: runs on every review submission. If unresolved threads remain,
an issue is upserted (created or body-updated). When all threads are resolved,
any open fix issue is closed.

Usage:
  uv run scripts/fix_unresolved_agent.py --repo OWNER/REPO --pr NUMBER

Required environment variables:
  GH_TOKEN  GitHub token with repo + pull request read/write access
"""

import argparse
import json
import os
import re
import sys
import urllib.request
from urllib.error import HTTPError

GH_TOKEN = os.environ["GH_TOKEN"]
REPO     = ""  # set by --repo arg


def gh(method: str, path: str, body: dict | None = None) -> dict:
    url = f"https://api.github.com{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url, data=data,
        headers={
            "Authorization": f"Bearer {GH_TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method=method,
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def graphql(query: str, variables: dict) -> dict:
    body = json.dumps({"query": query, "variables": variables}).encode()
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=body,
        headers={
            "Authorization": f"Bearer {GH_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


THREADS_QUERY = """
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      title
      headRefName
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          isOutdated
          comments(first: 5) {
            nodes {
              body
              path
              line
              author { login }
            }
          }
        }
      }
    }
  }
}
"""


def get_unresolved_threads(owner: str, repo: str, pr: int) -> tuple[list, str, str]:
    """Returns (unresolved_threads, pr_title, head_branch)."""
    data = graphql(THREADS_QUERY, {"owner": owner, "repo": repo, "number": pr})
    pr_data = data["data"]["repository"]["pullRequest"]
    threads = pr_data["reviewThreads"]["nodes"]
    unresolved = [t for t in threads if not t["isResolved"] and not t["isOutdated"]]
    return unresolved, pr_data["title"], pr_data["headRefName"]


def find_existing_fix_issue(repo: str, pr: int) -> int | None:
    """Search for an open fix issue for this PR tagged with 'copilot-fix'."""
    try:
        issues = gh("GET", f"/repos/{repo}/issues?state=open&labels=copilot-fix&per_page=50")
        marker = f"<!-- copilot-fix-pr-{pr} -->"
        for issue in issues:
            if marker in (issue.get("body") or ""):
                return issue["number"]
    except Exception:
        pass
    return None


def ensure_label(repo: str, name: str, color: str, description: str) -> None:
    try:
        gh("POST", f"/repos/{repo}/labels", {"name": name, "color": color, "description": description})
    except HTTPError as e:
        if e.code != 422:  # 422 = already exists
            raise


def build_issue_body(pr: int, pr_title: str, branch: str, threads: list, pr_url: str) -> str:
    lines = [
        f"<!-- copilot-fix-pr-{pr} -->",
        f"## Fix unresolved review comments — PR #{pr}",
        "",
        f"**PR:** [{pr_title}]({pr_url})",
        f"**Branch:** `{branch}`",
        "",
        "The following review threads are unresolved. Fix each one on the existing",
        f"feature branch `{branch}` and push — do not create a new branch.",
        "",
        "---",
        "",
    ]
    for i, thread in enumerate(threads, 1):
        comment = thread["comments"]["nodes"][0]
        author  = comment["author"]["login"]
        path    = comment.get("path") or "(general)"
        line    = comment.get("line") or ""
        body    = comment["body"].strip()
        loc     = f"`{path}`" + (f" line {line}" if line else "")
        lines += [
            f"### Thread {i} — {loc}",
            f"**Reviewer:** @{author}",
            "",
            body,
            "",
        ]
    lines += [
        "---",
        "",
        "When all threads are addressed, push the fixes to the branch above.",
        "The reviewer will resolve threads and approve when satisfied.",
    ]
    return "\n".join(lines)


def build_aider_prompt(pr: int, pr_title: str, branch: str, threads: list, pr_url: str) -> str:
    lines = [
        f"Fix the following unresolved code review comments on PR #{pr} ({pr_url}).",
        f"Branch: {branch}",
        "Address each reviewer concern by modifying the relevant file.",
        "Do NOT create a new branch. Commit fixes to the current branch.",
        "",
    ]
    for i, thread in enumerate(threads, 1):
        comment = thread["comments"]["nodes"][0]
        path = comment.get("path") or "(general)"
        line = comment.get("line") or ""
        body = comment["body"].strip()
        loc  = f"`{path}`" + (f" line {line}" if line else "")
        lines += [f"## Thread {i} — {loc}", body, ""]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True, help="owner/repo")
    parser.add_argument("--pr",   required=True, type=int)
    parser.add_argument("--prompt-output", default="/tmp/aider_fix_prompt.txt",
                        help="File to write aider fix prompt (used when threads found)")
    args = parser.parse_args()

    owner, repo_name = args.repo.split("/", 1)
    pr_url = f"https://github.com/{args.repo}/pull/{args.pr}"

    print(f"Checking unresolved threads on PR #{args.pr} …")
    unresolved, pr_title, branch = get_unresolved_threads(owner, repo_name, args.pr)
    print(f"  Unresolved threads: {len(unresolved)}")

    existing_issue = find_existing_fix_issue(args.repo, args.pr)

    if not unresolved:
        print("All threads resolved.")
        if existing_issue:
            print(f"Closing fix issue #{existing_issue} …")
            gh("PATCH", f"/repos/{args.repo}/issues/{existing_issue}",
               {"state": "closed", "state_reason": "completed"})
            gh("POST", f"/repos/{args.repo}/issues/{existing_issue}/comments",
               {"body": "All review threads resolved. Closing. ✅"})
        sys.exit(0)

    ensure_label(args.repo, "copilot-fix", "e4e669", "Unresolved review comments for aider to fix")

    body = build_issue_body(args.pr, pr_title, branch, unresolved, pr_url)
    title = f"[Fix] Unresolved review comments on PR #{args.pr}: {pr_title}"

    if existing_issue:
        print(f"Updating existing fix issue #{existing_issue} …")
        gh("PATCH", f"/repos/{args.repo}/issues/{existing_issue}", {"title": title, "body": body})
        issue_number = existing_issue
    else:
        print("Creating new fix issue …")
        issue = gh("POST", f"/repos/{args.repo}/issues", {
            "title": title,
            "body": body,
            "labels": ["copilot-fix"],
        })
        issue_number = issue["number"]
        print(f"  Created issue #{issue_number}")

    # Write aider prompt and branch name for the workflow to consume
    prompt = build_aider_prompt(args.pr, pr_title, branch, unresolved, pr_url)
    with open(args.prompt_output, "w") as f:
        f.write(prompt)
    with open("/tmp/fix_branch.txt", "w") as f:
        f.write(branch)

    print(f"Done. Issue #{issue_number} has {len(unresolved)} thread(s) for aider to fix.")
    print(f"  {pr_url}")
    sys.exit(1)  # signals workflow: threads found, run aider


if __name__ == "__main__":
    main()
