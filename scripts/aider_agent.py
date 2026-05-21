#!/usr/bin/env python3
"""
aider Agent — runs aider and handles multi-turn clarification via Jira comments.

Mode --start:
  Run aider with task spec. If no commits (aider asked questions):
    - Save conversation state to .aider_state.json on the branch
    - Post aider's question to the Jira ticket as a comment
    - Exit 2 (caller should push branch without opening PR)
  If commits made: exit 0 (caller opens PR normally).

Mode --continue:
  Load .aider_state.json, build continuation prompt, re-run aider.
  Same exit logic as --start.

Usage:
  uv run --with aider-chat scripts/aider_agent.py --start \
    --issue-key FREDDY-16 --prompt-file /tmp/aider_prompt.txt

  uv run --with aider-chat scripts/aider_agent.py --continue \
    --issue-key FREDDY-16 --answer "use Zod v3 for validation"

Required environment variables:
  ANTHROPIC_API_KEY
  JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN
"""

import argparse
import base64
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

MODEL = "claude-sonnet-4-6"
STATE_FILE = Path(".aider_state.json")


# ---------------------------------------------------------------------------
# Jira helpers
# ---------------------------------------------------------------------------

def _jira_auth() -> str:
    email = os.environ["JIRA_EMAIL"]
    token = os.environ["JIRA_API_TOKEN"]
    return "Basic " + base64.b64encode(f"{email}:{token}".encode()).decode()


def _jira_request(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{os.environ['JIRA_URL']}/rest/api/3{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url, data=data,
        headers={"Authorization": _jira_auth(), "Content-Type": "application/json", "Accept": "application/json"},
        method=method,
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read()) if r.length else {}


def post_jira_comment(issue_key: str, text: str) -> None:
    body = {
        "body": {
            "type": "doc", "version": 1,
            "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}],
        }
    }
    _jira_request("POST", f"/issue/{issue_key}/comment", body)
    print(f"Posted comment to {issue_key}")


# ---------------------------------------------------------------------------
# aider runner
# ---------------------------------------------------------------------------

def run_aider(message: str) -> str:
    """Run aider with --message, return captured output."""
    result = subprocess.run(
        ["uvx", "--from", "aider-chat", "aider",
         "--model", MODEL,
         "--message", message,
         "--yes",
         "--auto-commits",
         "--no-check-update"],
        capture_output=True, text=True,
    )
    output = result.stdout + result.stderr
    print(output)
    return output


def commits_made() -> bool:
    """True if aider committed at least one new commit on this branch vs origin/dev."""
    result = subprocess.run(
        ["git", "log", "--oneline", "origin/dev..HEAD"],
        capture_output=True, text=True,
    )
    return bool(result.stdout.strip())


def extract_question(output: str) -> str:
    """Extract the last substantive paragraph from aider output (its question)."""
    lines = [l for l in output.splitlines() if l.strip() and not l.startswith("Tokens:")]
    # Return last 20 meaningful lines
    return "\n".join(lines[-20:]) if lines else output[-800:]


# ---------------------------------------------------------------------------
# State management
# ---------------------------------------------------------------------------

def save_state(issue_key: str, branch: str, original_message: str,
               aider_output: str, round_: int) -> None:
    STATE_FILE.write_text(json.dumps({
        "issue_key": issue_key,
        "branch": branch,
        "original_message": original_message,
        "aider_output": aider_output,
        "round": round_,
    }, indent=2))
    subprocess.run(["git", "add", str(STATE_FILE)], check=True)
    subprocess.run(["git", "commit", "-m", f"chore: save aider conversation state (round {round_})"], check=True)


def load_state() -> dict:
    if not STATE_FILE.exists():
        print("ERROR: .aider_state.json not found — nothing to continue", file=sys.stderr)
        sys.exit(1)
    return json.loads(STATE_FILE.read_text())


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="mode", required=True)

    p_start = sub.add_parser("start")
    p_start.add_argument("--issue-key", required=True)
    p_start.add_argument("--branch", required=True)
    p_start.add_argument("--prompt-file", required=True)

    p_cont = sub.add_parser("continue")
    p_cont.add_argument("--issue-key", required=True)
    p_cont.add_argument("--answer", required=True)

    args = parser.parse_args()

    if args.mode == "start":
        prompt = Path(args.prompt_file).read_text()
        message = (
            "Implement this task completely. Do NOT ask for clarification or additional files. "
            "Create ALL required files from scratch. Begin immediately.\n\n---\n\n"
            + prompt
        )
        print(f"Running aider (round 1) for {args.issue_key} …")
        output = run_aider(message)

        if commits_made():
            print("aider made commits. PR can be opened.")
            sys.exit(0)

        question = extract_question(output)
        print("aider asked a question — posting to Jira …")

        state_branch = args.branch
        comment = (
            f"[aider-question] aider needs clarification before proceeding:\n\n"
            f"{question}\n\n"
            f"Reply to this ticket with your answer. "
            f"(branch: {state_branch})"
        )
        post_jira_comment(args.issue_key, comment)
        save_state(args.issue_key, state_branch, prompt, question, round_=1)
        sys.exit(2)  # caller: push branch, do NOT open PR yet

    elif args.mode == "continue":
        state = load_state()
        round_ = state["round"] + 1

        message = (
            f"Original task:\n{state['original_message']}\n\n"
            f"You previously asked:\n{state['aider_output']}\n\n"
            f"User answered:\n{args.answer}\n\n"
            "Now proceed with full implementation. Do not ask further questions."
        )
        print(f"Running aider (round {round_}) for {args.issue_key} …")
        output = run_aider(message)

        if commits_made():
            print("aider made commits.")
            # Remove state file now that we're done
            if STATE_FILE.exists():
                STATE_FILE.unlink()
                subprocess.run(["git", "add", str(STATE_FILE)], check=True)
                subprocess.run(["git", "commit", "-m", "chore: clear aider conversation state"], check=True)
            sys.exit(0)

        question = extract_question(output)
        print(f"aider asked another question (round {round_}) — posting to Jira …")
        state_branch = state["branch"]
        comment = (
            f"[aider-question] aider needs further clarification (round {round_}):\n\n"
            f"{question}\n\n"
            f"Reply to continue. (branch: {state_branch})"
        )
        post_jira_comment(args.issue_key, comment)
        save_state(args.issue_key, state_branch, state["original_message"], question, round_=round_)
        sys.exit(2)


if __name__ == "__main__":
    main()
