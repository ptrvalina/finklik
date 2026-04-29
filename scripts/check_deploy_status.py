#!/usr/bin/env python3
"""Check recent GitHub Actions deployment/CI status without gh CLI."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


def _api_get(url: str, token: str | None = None) -> dict[str, Any]:
    req = urllib.request.Request(url)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "finklik-deploy-check")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def _run_line(run: dict[str, Any]) -> str:
    name = run.get("name", "unknown")
    branch = run.get("head_branch", "-")
    status = run.get("status", "unknown")
    conclusion = run.get("conclusion") or "-"
    number = run.get("run_number", "?")
    html_url = run.get("html_url", "")
    return f"#{number} {name} [{branch}] status={status} conclusion={conclusion}\n  {html_url}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Check CI/deploy workflow status from GitHub API.")
    parser.add_argument("--repo", default="ptrvalina/finklik", help="GitHub repo in owner/name format")
    parser.add_argument("--branch", default="main", help="Branch to filter runs")
    parser.add_argument("--limit", type=int, default=25, help="How many recent runs to fetch")
    parser.add_argument(
        "--token",
        default=None,
        help="Optional GitHub token (or use GITHUB_TOKEN env var) for private repos/rate limits",
    )
    args = parser.parse_args()

    token = args.token
    if token is None:
        token = None

    owner_repo = args.repo.strip()
    encoded_repo = urllib.parse.quote(owner_repo, safe="/")
    url = (
        f"https://api.github.com/repos/{encoded_repo}/actions/runs"
        f"?per_page={max(1, min(args.limit, 100))}&branch={urllib.parse.quote(args.branch)}"
    )

    try:
        payload = _api_get(url, token=token)
    except urllib.error.HTTPError as exc:
        print(f"GitHub API error: HTTP {exc.code}", file=sys.stderr)
        try:
            body = exc.read().decode("utf-8", errors="ignore")
            if body:
                print(body, file=sys.stderr)
        except Exception:
            pass
        return 1
    except Exception as exc:
        print(f"Failed to query GitHub API: {exc}", file=sys.stderr)
        return 1

    runs = payload.get("workflow_runs", [])
    if not runs:
        print("No workflow runs found.")
        return 0

    targets = ("CI", "Deploy GitHub Pages")
    print(f"Repository: {owner_repo}")
    print(f"Branch: {args.branch}\n")

    for target in targets:
        run = next((r for r in runs if r.get("name") == target), None)
        if run is None:
            print(f"{target}: not found in last {args.limit} runs")
        else:
            print(f"{target}:")
            print(_run_line(run))
        print()

    print("Recent runs:")
    for run in runs[:10]:
        print(_run_line(run))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
