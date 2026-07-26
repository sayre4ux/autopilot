"""Smoke tests for the PreToolUse Bash guard: it blocks only in strict mode, and fails open."""

import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
GUARD = REPO / "hooks" / "scripts" / "guard-bash.py"


def run_guard(stdin_text, mode=None, home=None):
    argv = [sys.executable, str(GUARD)]
    if mode is not None:
        argv += ["--mode", mode]
    # A real ~/.autopilot/config.jsonc must not decide the outcome of these tests.
    env = {"PATH": "/usr/bin:/bin", "HOME": str(home)} if home else None
    return subprocess.run(
        argv, input=stdin_text, capture_output=True, text=True, timeout=30, env=env
    )


def payload(command):
    return json.dumps({"tool_name": "Bash", "tool_input": {"command": command}})


CATASTROPHIC = [
    "rm -rf /",
    "git push --force origin main",
    "git commit --no-verify -m wip",
    "psql -c 'DROP TABLE users'",
]


def test_strict_blocks_catastrophic_commands():
    for command in CATASTROPHIC:
        result = run_guard(payload(command), mode="strict")
        assert result.returncode == 2, f"{command!r} was not blocked: {result.stderr}"
        assert "Autopilot Bash guard" in result.stderr


def test_advisory_warns_without_blocking():
    result = run_guard(payload("rm -rf /"), mode="advisory")
    assert result.returncode == 0
    assert "Autopilot Bash guard" in result.stderr


def test_off_mode_is_silent():
    result = run_guard(payload("rm -rf /"), mode="off")
    assert result.returncode == 0
    assert result.stderr == ""


def test_benign_commands_pass_in_strict_mode():
    for command in ["ls -la", "rm -rf ./build", "git push origin feature/x", "npm test"]:
        result = run_guard(payload(command), mode="strict")
        assert result.returncode == 0, f"{command!r} was blocked: {result.stderr}"
        assert result.stderr == ""


def test_fails_open_on_malformed_input(tmp_path):
    home = tmp_path / "home"
    home.mkdir()
    for stdin_text in ["", "   ", "{not json", "null", "[]", json.dumps({"tool_input": {}})]:
        result = run_guard(stdin_text, mode="strict", home=home)
        assert result.returncode == 0, f"{stdin_text!r} did not fail open"


def test_fails_open_with_no_mode_flag_and_empty_home(tmp_path):
    home = tmp_path / "home"
    home.mkdir()
    # No --mode, no config file: the default is advisory, so nothing blocks.
    result = run_guard(payload("rm -rf /"), home=home)
    assert result.returncode == 0
