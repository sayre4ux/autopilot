"""Smoke tests for the Stop hook: advisory only, never blocks, always fails open."""

import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
NUDGE = REPO / "hooks" / "scripts" / "ledger-nudge.py"

LEDGER = """| task | status | session |
| --- | --- | --- |
| T-1 | active | sess-abc |
| T-2 | done | sess-abc |
"""


def run_nudge(stdin_text, mode=None, home=None):
    argv = [sys.executable, str(NUDGE)]
    if mode is not None:
        argv += ["--mode", mode]
    env = {"PATH": "/usr/bin:/bin", "HOME": str(home)} if home else None
    return subprocess.run(
        argv, input=stdin_text, capture_output=True, text=True, timeout=30, env=env
    )


def test_nudges_but_does_not_block_on_active_rows(tmp_path):
    (tmp_path / ".autopilot").mkdir()
    (tmp_path / ".autopilot" / "ledger.md").write_text(LEDGER, encoding="utf-8")
    stdin_text = json.dumps({"cwd": str(tmp_path), "session_id": "sess-abc"})
    for mode in ["advisory", "strict"]:
        result = run_nudge(stdin_text, mode=mode)
        assert result.returncode == 0
        assert "Autopilot ledger nudge: 1 active/open task(s)" in result.stderr


def test_silent_when_no_ledger(tmp_path):
    result = run_nudge(json.dumps({"cwd": str(tmp_path)}), mode="strict")
    assert result.returncode == 0
    assert result.stderr == ""


def test_fails_open_on_garbage_input(tmp_path):
    home = tmp_path / "home"
    home.mkdir()
    for stdin_text in ["", "{not json", "null", "[]", json.dumps({"cwd": ""}), "\x00"]:
        result = run_nudge(stdin_text, mode="strict", home=home)
        assert result.returncode == 0, f"{stdin_text!r} did not fail open"
