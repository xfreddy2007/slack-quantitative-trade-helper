#!/usr/bin/env python3
"""
PM Agent — reads a Jira ticket and produces a GitHub issue spec for Copilot.

Fetches the Jira ticket, passes it to Claude (acting as Picky-PM), and writes
a structured GitHub issue body that the Copilot coding agent can act on.

Usage:
  uv run --with anthropic scripts/pm_agent.py --issue-key FREDDY-14 --output /tmp/issue.json

Required environment variables:
  JIRA_URL           https://xfreddy2007.atlassian.net
  JIRA_EMAIL         xfreddy2007@gmail.com
  JIRA_API_TOKEN     Atlassian API token
  ANTHROPIC_API_KEY  Claude API key
"""

import argparse
import base64
import json
import os
import sys
import urllib.request
from pathlib import Path

JIRA_URL = os.environ["JIRA_URL"]
JIRA_EMAIL = os.environ["JIRA_EMAIL"]
JIRA_API_TOKEN = os.environ["JIRA_API_TOKEN"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

ROOT = Path(__file__).parent.parent
PM_ROLE_PATH = ROOT / "docs" / "PM_ROLE.md"
COPILOT_INSTRUCTIONS_PATH = ROOT / ".github" / "copilot-instructions.md"
IMPLEMENT_SKILL_PATH = Path.home() / ".claude" / "skills" / "implement-feature" / "SKILL.md"


def _jira_auth() -> str:
    token = base64.b64encode(f"{JIRA_EMAIL}:{JIRA_API_TOKEN}".encode()).decode()
    return f"Basic {token}"


def fetch_jira_ticket(issue_key: str) -> dict:
    url = f"{JIRA_URL}/rest/api/3/issue/{issue_key}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": _jira_auth(),
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def extract_adf_text(node: dict | list | None) -> str:
    """Recursively extract plain text from an Atlassian Document Format node."""
    if not node:
        return ""
    if isinstance(node, list):
        return "".join(extract_adf_text(n) for n in node)
    if isinstance(node, dict):
        if node.get("type") == "text":
            return node.get("text", "")
        return extract_adf_text(node.get("content", []))
    return ""


def call_claude(system: str, user: str) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return msg.content[0].text


def build_system_prompt() -> str:
    pm_role = PM_ROLE_PATH.read_text() if PM_ROLE_PATH.exists() else ""
    copilot_instr = COPILOT_INSTRUCTIONS_PATH.read_text() if COPILOT_INSTRUCTIONS_PATH.exists() else ""
    implement_skill = IMPLEMENT_SKILL_PATH.read_text() if IMPLEMENT_SKILL_PATH.exists() else ""
    return f"""You are Picky-PM, the Product Manager for this project.

{pm_role}

The engineer (Copilot) follows these instructions:
{copilot_instr}

Copilot must follow this implementation workflow for every task:
{implement_skill}

Your job: a Jira ticket just moved to In Progress. Produce a GitHub issue body that \
gives Copilot precise, actionable instructions to implement the task. The issue body \
must embed the implement-feature workflow steps so Copilot executes them in order.

Output ONLY a JSON object with these exact fields — no prose before or after:
{{
  "title": "<same as Jira ticket summary>",
  "body": "<Markdown GitHub issue body — the FIRST line of the body MUST be exactly: '**Jira:** ISSUE_KEY' \
(e.g. '**Jira:** FREDDY-15'). Then include: task description, acceptance criteria, \
technical notes referencing the relevant stack (TypeScript/Python/infra), branch naming \
convention (feature/T{{N}}.{{M}}.{{P}}-slug from dev), verification commands, and \
the implement-feature workflow steps (classify scope, load senior skills, implement, \
verify errors, unit tests, e2e, code review, done summary)>",
  "labels": ["aider"]
}}"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--issue-key", required=True, help="Jira issue key, e.g. FREDDY-14")
    parser.add_argument("--output", required=True, help="Path to write output JSON")
    args = parser.parse_args()

    print(f"Fetching Jira ticket {args.issue_key} …")
    ticket = fetch_jira_ticket(args.issue_key)
    fields = ticket["fields"]

    summary = fields.get("summary", "")
    description_text = extract_adf_text(fields.get("description"))
    labels = fields.get("labels", [])
    parent_summary = (fields.get("parent") or {}).get("fields", {}).get("summary", "")

    print(f"  Summary : {summary}")
    print(f"  Epic    : {parent_summary}")
    print(f"  Labels  : {labels}")

    user_prompt = f"""Jira ticket just moved to In Progress:

Ticket   : {args.issue_key}
Epic     : {parent_summary}
Summary  : {summary}
Labels   : {", ".join(labels)}

Description:
{description_text}

Produce the GitHub issue JSON now."""

    print("Calling Claude (PM role) …")
    raw = call_claude(build_system_prompt(), user_prompt).strip()

    # Strip markdown code fences if model wraps in ```json
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"Claude returned invalid JSON: {e}", file=sys.stderr)
        print(raw, file=sys.stderr)
        sys.exit(1)

    Path(args.output).write_text(json.dumps(parsed, ensure_ascii=False, indent=2))
    print(f"Issue spec written to {args.output}")
    print(f"  Title: {parsed['title']}")


if __name__ == "__main__":
    main()
