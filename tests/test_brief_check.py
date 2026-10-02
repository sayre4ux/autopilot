"""Tests for the PreToolUse brief check: strict denies, advisory adds context, and it fails open."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
CHECK = REPO / "hooks" / "scripts" / "brief-check.py"

WITH_CRITERIA = """<dispatch>
  <to>engineer</to>
  <objective>Add a flag.</objective>
  <acceptance_criteria>
    - The flag parses
  </acceptance_criteria>
</dispatch>
"""

WITHOUT_CRITERIA = """<dispatch>
  <to>engineer</to>
  <objective>Add a flag.</objective>
  <redlines>none</redlines>
</dispatch>
"""

EMPTY_CRITERIA = """<dispatch>
  <to>engineer</to>
  <acceptance_criteria>

  </acceptance_criteria>
</dispatch>
"""

MARKDOWN_CRITERIA = """# Task T-009

## Acceptance criteria

- Tests pass

## Redlines
"""

MARKDOWN_EMPTY_CRITERIA = """# Task T-009

## Acceptance criteria

## Redlines
- none
"""

ENFORCED = [
    "autopilot:architect",
    "autopilot:engineer",
    "autopilot:senior-engineer",
    "autopilot:engineer-doc",
    "autopilot:security-engineer",
]


@pytest.fixture
def home(tmp_path):
    path = tmp_path / "home"
    path.mkdir()
    return path


def run_check(stdin_text, home, mode=None, env_mode=None):
    argv = [sys.executable, str(CHECK)]
    if mode is not None:
        argv += ["--mode", mode]
    # A real ~/.autopilot/config.jsonc or plugin option must not decide these outcomes.
    env = {"PATH": "/usr/bin:/bin", "HOME": str(home)}
    if env_mode is not None:
        env["CLAUDE_PLUGIN_OPTION_ENFORCEMENT"] = env_mode
    return subprocess.run(argv, input=stdin_text, capture_output=True, text=True, timeout=30, env=env)


def payload(prompt, subagent_type="autopilot:engineer", cwd=None):
    data = {
        "tool_name": "Agent",
        "tool_input": {"subagent_type": subagent_type, "prompt": prompt, "description": "task"},
    }
    if cwd is not None:
        data["cwd"] = str(cwd)
    return json.dumps(data)


def output(result):
    """The hookSpecificOutput the check emitted, or None when it stayed silent."""
    assert result.returncode == 0
    assert result.stderr == ""
    if not result.stdout.strip():
        return None
    data = json.loads(result.stdout)
    assert set(data) == {"hookSpecificOutput"}
    hso = data["hookSpecificOutput"]
    assert hso["hookEventName"] == "PreToolUse"
    return hso


def assert_denied(result):
    hso = output(result)
    assert hso is not None, "expected a deny"
    assert hso["permissionDecision"] == "deny"
    assert hso["permissionDecisionReason"].startswith("Autopilot brief check:")
    assert "<acceptance_criteria>" in hso["permissionDecisionReason"]
    assert "redispatch" in hso["permissionDecisionReason"]
    assert "additionalContext" not in hso


def assert_advised(result):
    hso = output(result)
    assert hso is not None, "expected advisory context"
    assert set(hso) == {"hookEventName", "additionalContext"}
    assert hso["additionalContext"].startswith("Autopilot brief check:")
    assert "<acceptance_criteria>" in hso["additionalContext"]


def assert_silent(result):
    assert output(result) is None, f"expected silence, got {result.stdout!r}"


# Inline briefs


def test_inline_with_criteria_is_silent(home):
    for mode in ("strict", "advisory"):
        assert_silent(run_check(payload(WITH_CRITERIA), home, mode=mode))


def test_inline_without_criteria_strict_denies_every_enforced_role(home):
    for role in ENFORCED:
        assert_denied(run_check(payload(WITHOUT_CRITERIA, role), home, mode="strict"))


def test_inline_without_criteria_advisory_adds_context(home):
    assert_advised(run_check(payload(WITHOUT_CRITERIA), home, mode="advisory"))


def test_inline_whitespace_only_criteria_counts_as_missing(home):
    assert_denied(run_check(payload(EMPTY_CRITERIA), home, mode="strict"))


def test_inline_brief_ignores_material_paths(home, tmp_path):
    material = tmp_path / "design.md"
    material.write_text(WITH_CRITERIA)
    prompt = WITHOUT_CRITERIA.replace("<redlines>", f"<materials>{material}</materials>\n  <redlines>")
    assert_denied(run_check(payload(prompt), home, mode="strict"))


def test_markdown_heading_criteria(home):
    assert_silent(run_check(payload(MARKDOWN_CRITERIA), home, mode="strict"))
    assert_denied(run_check(payload(MARKDOWN_EMPTY_CRITERIA), home, mode="strict"))


def test_prompt_with_no_brief_at_all_counts_as_missing(home):
    assert_denied(run_check(payload("Please fix the bug in the parser."), home, mode="strict"))


# Path briefs


def test_absolute_path_brief(home, tmp_path):
    good = tmp_path / "good.md"
    good.write_text(WITH_CRITERIA)
    bad = tmp_path / "bad.md"
    bad.write_text(WITHOUT_CRITERIA)
    assert_silent(run_check(payload(f"Your self-contained dispatch brief is at {good}."), home, mode="strict"))
    assert_denied(run_check(payload(f"Your self-contained dispatch brief is at {bad}."), home, mode="strict"))
    assert_advised(run_check(payload(f"Read `{bad}` and execute it."), home, mode="advisory"))


def test_relative_path_brief_resolves_against_cwd(home, tmp_path):
    project = tmp_path / "project"
    dispatch = project / ".autopilot" / "dispatch"
    dispatch.mkdir(parents=True)
    (dispatch / "T-001.md").write_text(WITH_CRITERIA)
    (dispatch / "T-002.md").write_text(WITHOUT_CRITERIA)
    good = payload("Brief: .autopilot/dispatch/T-001.md", cwd=project)
    bad = payload("Brief: .autopilot/dispatch/T-002.md", cwd=project)
    assert_silent(run_check(good, home, mode="strict"))
    assert_denied(run_check(bad, home, mode="strict"))
    # Without a cwd the relative path cannot be resolved, so the brief is unknown.
    assert_silent(run_check(payload("Brief: .autopilot/dispatch/T-002.md"), home, mode="strict"))


def test_any_readable_candidate_with_criteria_passes(home, tmp_path):
    design = tmp_path / "design.md"
    design.write_text("# Design\n\nNo criteria here.\n")
    brief = tmp_path / "brief.md"
    brief.write_text(WITH_CRITERIA)
    prompt = f"Design is {design}; your brief is at {brief}."
    assert_silent(run_check(payload(prompt), home, mode="strict"))


def test_unreadable_path_is_silent(home, tmp_path):
    missing = tmp_path / "nope" / "T-404.md"
    assert_silent(run_check(payload(f"Your brief is at {missing}"), home, mode="strict"))

    directory = tmp_path / "dir.md"
    directory.mkdir()
    assert_silent(run_check(payload(f"Your brief is at {directory}"), home, mode="strict"))

    huge = tmp_path / "huge.md"
    huge.write_text(WITHOUT_CRITERIA + "x" * (256 * 1024))
    assert_silent(run_check(payload(f"Your brief is at {huge}"), home, mode="strict"))


@pytest.mark.skipif(os.geteuid() == 0, reason="root ignores file permissions")
def test_permission_denied_path_is_silent(home, tmp_path):
    locked = tmp_path / "locked.md"
    locked.write_text(WITHOUT_CRITERIA)
    locked.chmod(0)
    try:
        assert_silent(run_check(payload(f"Your brief is at {locked}"), home, mode="strict"))
    finally:
        locked.chmod(0o600)


# Exemptions


def test_exempt_autopilot_roles_are_silent(home):
    for role in ("autopilot:reviewer", "autopilot:verifier", "autopilot:supervisor"):
        assert_silent(run_check(payload(WITHOUT_CRITERIA, role), home, mode="strict"))


def test_non_autopilot_types_are_silent(home):
    for role in ("general-purpose", "Explore", "engineer", "other-plugin:engineer", None):
        assert_silent(run_check(payload(WITHOUT_CRITERIA, role), home, mode="strict"))


# Modes


def test_off_mode_is_silent(home):
    assert_silent(run_check(payload(WITHOUT_CRITERIA), home, mode="off"))


def test_default_mode_is_advisory(home):
    assert_advised(run_check(payload(WITHOUT_CRITERIA), home))


def test_mode_precedence(home):
    config_dir = home / ".autopilot"
    config_dir.mkdir()
    (config_dir / "config.jsonc").write_text('{\n  // comment\n  "enforcement": "strict"\n}\n')
    assert_denied(run_check(payload(WITHOUT_CRITERIA), home))
    assert_advised(run_check(payload(WITHOUT_CRITERIA), home, env_mode="advisory"))
    assert_silent(run_check(payload(WITHOUT_CRITERIA), home, env_mode="off"))
    assert_denied(run_check(payload(WITHOUT_CRITERIA), home, mode="strict", env_mode="off"))
    # An invalid --mode falls through to the env value.
    assert_silent(run_check(payload(WITHOUT_CRITERIA), home, mode="bogus", env_mode="off"))


# Fail-open


def test_fails_open_on_malformed_input(home):
    cases = [
        "",
        "   ",
        "{not json",
        "null",
        "[]",
        json.dumps({}),
        json.dumps({"tool_input": None}),
        json.dumps({"tool_input": []}),
        json.dumps({"tool_input": {"subagent_type": "autopilot:engineer"}}),
        json.dumps({"tool_input": {"subagent_type": "autopilot:engineer", "prompt": 42}}),
        json.dumps({"tool_input": {"subagent_type": ["autopilot:engineer"], "prompt": "x"}}),
        json.dumps({"tool_input": {"subagent_type": "autopilot:engineer", "prompt": "brief.md"}, "cwd": 7}),
    ]
    for stdin_text in cases:
        result = run_check(stdin_text, home, mode="strict")
        assert result.returncode == 0, f"{stdin_text!r} did not fail open"
        assert result.stdout == "", f"{stdin_text!r} produced output: {result.stdout!r}"
