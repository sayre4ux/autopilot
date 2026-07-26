#!/usr/bin/env python3
"""Fail-open Stop hook that reminds a session about its active ledger rows."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
from typing import Any


def _project_and_session(payload: Any) -> tuple[Path, str | None]:
    if not isinstance(payload, dict):
        raise TypeError("hook input must be an object")
    cwd = payload.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR")
    if not isinstance(cwd, str) or not cwd:
        raise ValueError("project directory unavailable")
    session = payload.get("session_id")
    return Path(cwd), session if isinstance(session, str) and session else None


def _owned_active_rows(text: str, session: str | None) -> list[str]:
    rows = []
    for line in text.splitlines():
        if not line.lstrip().startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if not any(cell.lower() in {"active", "open"} for cell in cells):
            continue
        if session is None or session in line:
            rows.append(line.strip())
    return rows


def main() -> int:
    try:
        parser = argparse.ArgumentParser()
        parser.add_argument("--mode", default="advisory")
        args = parser.parse_args()
        mode = args.mode
        if mode not in {"off", "advisory", "strict"}:
            config = Path.home() / ".autopilot" / "config.jsonc"
            mode = "advisory"
            if config.is_file():
                try:
                    import re
                    text = re.sub(r"//[^\n]*", "", config.read_text(encoding="utf-8"))
                    mode = json.loads(text).get("enforcement", "advisory")
                except Exception:
                    pass
            if mode not in {"off", "advisory", "strict"}:
                mode = "advisory"
        if mode == "off":
            return 0

        payload = json.load(sys.stdin)
        project, session = _project_and_session(payload)
        ledger = project / ".autopilot" / "ledger.md"
        if not ledger.is_file():
            return 0
        rows = _owned_active_rows(ledger.read_text(encoding="utf-8"), session)
        if rows:
            print(
                f"Autopilot ledger nudge: {len(rows)} active/open task(s) still owned by this session.",
                file=sys.stderr,
            )
        return 0
    except BaseException:
        # Reconciliation advice must never prevent a session from stopping.
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
