"""Smoke tests for the Stop hook: advisory only, never blocks, always fails open."""

import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
NUDGE = REPO / "hooks" / "scripts" / "ledger-nudge.py"

# The shape SKILL.md ships: no session column.
LEDGER = """# Task Ledger

Vehicle: agent-tool
Callback: none

| Task ID | Type | Role | Status | Depends On | Vehicle | Model Used | Notes |
|---|---|---|---|---|---|---|---|
| T-1 | code | engineer | active | - | agent-tool | opus medium | |
| T-2 | code | engineer | done | - | agent-tool | opus medium | |
| T-3 | review | reviewer | open | T-1 | agent-tool | opus high | |
| T-4 | code | engineer | awaiting | - | cli | gpt-6-luna | background task |
"""

# A ledger that records owning sessions: only this session's rows count.
SESSION_LEDGER = """| task | status | session |
| --- | --- | --- |
| T-1 | active | sess-abc |
| T-2 | done | sess-abc |
| T-3 | active | sess-other |
"""


def run_nudge(stdin_text, mode=None, home=None):
    argv = [sys.executable, str(NUDGE)]
    if mode is not None:
        argv += ["--mode", mode]
    env = {"PATH": "/usr/bin:/bin", "HOME": str(home)} if home else None
    return subprocess.run(
        argv, input=stdin_text, capture_output=True, text=True, timeout=30, env=env
    )


def nudge_message(result):
    if not result.stdout.strip():
        return None
    return json.loads(result.stdout)["systemMessage"]


def write_ledger(tmp_path, text):
    (tmp_path / ".autopilot").mkdir()
    (tmp_path / ".autopilot" / "ledger.md").write_text(text, encoding="utf-8")


def test_nudges_on_shipped_ledger_template_despite_session_id(tmp_path):
    write_ledger(tmp_path, LEDGER)
    stdin_text = json.dumps({"cwd": str(tmp_path), "session_id": "sess-abc"})
    for mode in ["advisory", "strict"]:
        result = run_nudge(stdin_text, mode=mode)
        assert result.returncode == 0
        assert "Autopilot ledger nudge: 2 active/open task(s)" in nudge_message(result)


def test_filters_to_owned_rows_when_ledger_records_sessions(tmp_path):
    write_ledger(tmp_path, SESSION_LEDGER)
    stdin_text = json.dumps({"cwd": str(tmp_path), "session_id": "sess-abc"})
    result = run_nudge(stdin_text, mode="advisory")
    assert result.returncode == 0
    assert "Autopilot ledger nudge: 1 active/open task(s) still owned by this session" in nudge_message(result)


def test_unknown_session_counts_every_open_row_without_claiming_ownership(tmp_path):
    write_ledger(tmp_path, SESSION_LEDGER)
    result = run_nudge(json.dumps({"cwd": str(tmp_path), "session_id": "nobody"}), mode="advisory")
    message = nudge_message(result)
    assert "2 active/open task(s) still open in" in message
    assert "owned by this session" not in message


def test_silent_when_no_open_rows(tmp_path):
    write_ledger(tmp_path, LEDGER.replace("| active |", "| done |").replace("| open |", "| done |"))
    result = run_nudge(json.dumps({"cwd": str(tmp_path), "session_id": "s"}), mode="strict")
    assert result.returncode == 0
    assert nudge_message(result) is None


def test_silent_when_no_ledger(tmp_path):
    result = run_nudge(json.dumps({"cwd": str(tmp_path)}), mode="strict")
    assert result.returncode == 0
    assert result.stdout == ""


def test_fails_open_on_garbage_input(tmp_path):
    home = tmp_path / "home"
    home.mkdir()
    for stdin_text in ["", "{not json", "null", "[]", json.dumps({"cwd": ""}), "\x00"]:
        result = run_nudge(stdin_text, mode="strict", home=home)
        assert result.returncode == 0, f"{stdin_text!r} did not fail open"
