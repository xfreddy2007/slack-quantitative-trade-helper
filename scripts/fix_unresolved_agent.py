#!/usr/bin/env python3
"""
Fetch unresolved review threads from a PR and write an aider fix prompt.

Exit 0: no unresolved threads (nothing to fix).
Exit 1: unresolved threads found; prompt written to --output.

Usage:
  python3 scripts/fix_unresolved_agent.py --repo OWNER/REPO --pr NUMBER \
    --output /tmp/aider_fix_prompt.txt

Required env:
  GH_TOKEN
"""

import argparse, json, os, sys, urllib.request

GH_TOKEN = os.environ["GH_TOKEN"]

THREADS_QUERY = """
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      title
      headRefName
      reviewThreads(first: 100) {
        nodes {
          isResolved
          isOutdated
          comments(first: 3) {
            nodes { body path line author { login } }
          }
        }
      }
    }
  }
}
"""


def graphql(query, variables):
    body = json.dumps({"query": query, "variables": variables}).encode()
    req = urllib.request.Request(
        "https://api.github.com/graphql", data=body,
        headers={"Authorization": f"Bearer {GH_TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--pr",   required=True, type=int)
    parser.add_argument("--output", default="/tmp/aider_fix_prompt.txt")
    args = parser.parse_args()

    owner, repo_name = args.repo.split("/", 1)
    data = graphql(THREADS_QUERY, {"owner": owner, "repo": repo_name, "number": args.pr})
    pr_data = data["data"]["repository"]["pullRequest"]
    branch = pr_data["headRefName"]
    pr_url = f"https://github.com/{args.repo}/pull/{args.pr}"

    unresolved = [
        t for t in pr_data["reviewThreads"]["nodes"]
        if not t["isResolved"] and not t["isOutdated"]
    ]
    print(f"Unresolved threads: {len(unresolved)}")

    if not unresolved:
        sys.exit(0)

    lines = [
        f"Fix the following unresolved code review comments on PR #{args.pr}: {pr_url}",
        f"Branch: {branch}",
        "Fix each issue in-place. Do not create a new branch. Commit all fixes.",
        "",
    ]
    for i, thread in enumerate(unresolved, 1):
        c    = thread["comments"]["nodes"][0]
        path = c.get("path") or "(general)"
        line = c.get("line") or ""
        loc  = f"`{path}`" + (f" line {line}" if line else "")
        lines += [f"### Thread {i} — {loc}", f"Reviewer: @{c['author']['login']}", c["body"].strip(), ""]

    with open(args.output, "w") as f:
        f.write("\n".join(lines))
    with open("/tmp/fix_branch.txt", "w") as f:
        f.write(branch)

    sys.exit(1)  # signals caller: threads found, run aider


if __name__ == "__main__":
    main()
