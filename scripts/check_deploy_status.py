#!/usr/bin/env python3
"""Check recent GitHub Actions deployment/CI status without gh CLI."""

from __future__ import annotations

import argparse
import json
import os
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
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def _run_line(run: dict[str, Any]) -> str:
    name = run.get("name", "unknown")
    branch = run.get("head_branch", "-")
    status = run.get("status", "unknown")
    conclusion = run.get("conclusion") or "-"
    number = run.get("run_number", "?")
    html_url = run.get("html_url", "")
    return f"#{number} {name} [{branch}] status={status} conclusion={conclusion}\n  {html_url}"


def _workflow_by_name(workflows_payload: dict[str, Any], workflow_name: str) -> dict[str, Any] | None:
    for wf in workflows_payload.get("workflows", []) or []:
        if wf.get("name") == workflow_name:
            return wf
    return None


def _latest_run_for_workflow(
    owner_repo: str,
    workflow_id: int,
    branch: str,
    token: str | None,
) -> dict[str, Any] | None:
    encoded_repo = urllib.parse.quote(owner_repo, safe="/")
    branch_q = urllib.parse.quote(branch, safe="")
    url = (
        f"https://api.github.com/repos/{encoded_repo}/actions/workflows/"
        f"{workflow_id}/runs?branch={branch_q}&per_page=1"
    )
    payload = _api_get(url, token=token)
    runs = payload.get("workflow_runs") or []
    return runs[0] if runs else None


def main() -> int:
    parser = argparse.ArgumentParser(description="Check CI/deploy workflow status from GitHub API.")
    parser.add_argument("--repo", default="ptrvalina/finklik", help="GitHub repo in owner/name format")
    parser.add_argument("--branch", default="main", help="Branch to filter runs")
    parser.add_argument("--limit", type=int, default=25, help="How many recent runs to fetch for overview")
    parser.add_argument(
        "--token",
        default=None,
        help="Optional GitHub token (or use GITHUB_TOKEN env var) for private repos/rate limits",
    )
    args = parser.parse_args()

    token = args.token or os.environ.get("GITHUB_TOKEN")

    owner_repo = args.repo.strip()
    encoded_repo = urllib.parse.quote(owner_repo, safe="/")
    runs_url = (
        f"https://api.github.com/repos/{encoded_repo}/actions/runs"
        f"?per_page={max(1, min(args.limit, 100))}&branch={urllib.parse.quote(args.branch)}"
    )

    try:
        payload = _api_get(runs_url, token=token)
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

    try:
        workflows_payload = _api_get(
            f"https://api.github.com/repos/{encoded_repo}/actions/workflows?per_page=100",
            token=token,
        )
    except Exception as exc:
        workflows_payload = {"workflows": []}
        print(f"(Workflow list unavailable: {exc}; falling back to recent runs only)\n", file=sys.stderr)

    for target in targets:
        wf = _workflow_by_name(workflows_payload, target)
        if wf is None:
            run = next((r for r in runs if r.get("name") == target), None)
            if run is None:
                print(f"{target}: workflow not found by name; no matching run in last {args.limit}")
            else:
                print(f"{target}: (from recent runs)")
                print(_run_line(run))
        else:
            latest = _latest_run_for_workflow(owner_repo, int(wf["id"]), args.branch, token)
            if latest is None:
                print(f"{target}: no runs on branch `{args.branch}`")
            else:
                print(f"{target}:")
                print(_run_line(latest))
        print()

    print("Recent runs:")
    for run in runs[:10]:
        print(_run_line(run))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
