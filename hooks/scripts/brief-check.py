#!/usr/bin/env python3
"""Fail-open PreToolUse hook that checks an autopilot role dispatch carries acceptance criteria.

Strict mode denies a dispatch whose brief has none; advisory mode hands the model a note and
leaves the permission flow alone. A brief that cannot be found or read is never judged.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import sys
from typing import Any

# Roles briefed with the canonical <dispatch> block or templates T1-T5, all of which carry
# <acceptance_criteria>. Reviewer gets the <review> block, verifier a claimed outcome to
# refute, supervisor a goal-first brief "not a checklist"; none of those carry criteria.
ENFORCED_TYPES = {
    "autopilot:architect",
    "autopilot:engineer",
    "autopilot:senior-engineer",
    "autopilot:engineer-doc",
    "autopilot:security-engineer",
}

# DECISION: 256 KB cap and at most 8 candidate paths; a larger brief is treated as unreadable.
MAX_BRIEF_BYTES = 256 * 1024
MAX_CANDIDATES = 8

MESSAGE = (
    "Autopilot brief check: this {role} dispatch has no acceptance criteria. Add an "
    "<acceptance_criteria> block listing concrete, verifiable criteria to the brief "
    "(see skills/orchestrate/references/dispatch.md), then redispatch."
)

_XML_CRITERIA = re.compile(r"<acceptance_criteria\b[^>]*>(.*?)</acceptance_criteria\s*>", re.DOTALL | re.IGNORECASE)
_MD_HEADING = re.compile(r"^\s{0,3}#{1,6}\s")
_MD_CRITERIA_HEADING = re.compile(r"^\s{0,3}#{1,6}\s*acceptance criteria\b", re.IGNORECASE)
_TOKEN_SPLIT = re.compile(r"[\s`'\"<>()\[\]{}]+")


def _resolve_mode(cli_mode: str | None) -> str:
    """Enforcement mode precedence: valid --mode > plugin userConfig (env) > ~/.autopilot/config.jsonc > advisory."""
    valid = {"off", "advisory", "strict"}
    if cli_mode in valid:
        return cli_mode
    env_mode = os.environ.get("CLAUDE_PLUGIN_OPTION_ENFORCEMENT")
    if env_mode in valid:
        return env_mode
    config = Path.home() / ".autopilot" / "config.jsonc"
    if config.is_file():
        try:
            text = re.sub(r"//[^\n]*", "", config.read_text(encoding="utf-8"))
            mode = json.loads(text).get("enforcement")
            if mode in valid:
                return mode
        except Exception:
            pass
    return "advisory"


def _has_criteria(text: str) -> bool:
    # DECISION: accept the XML element (what the templates use) or a markdown
    # "Acceptance criteria" heading with at least one non-empty line before the next heading.
    if any(match.group(1).strip() for match in _XML_CRITERIA.finditer(text)):
        return True
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if not _MD_CRITERIA_HEADING.match(line):
            continue
        for following in lines[index + 1 :]:
            if _MD_HEADING.match(following):
                break
            if following.strip():
                return True
    return False


def _candidate_paths(prompt: str, cwd: Any) -> list[Path | None]:
    """Every `.md` token in the prompt as a path; None for a relative one with no usable cwd."""
    paths: list[Path | None] = []
    for token in _TOKEN_SPLIT.split(prompt):
        token = token.rstrip(".,;:!?")
        if not token.endswith(".md"):
            continue
        path: Path | None = Path(token).expanduser()
        if not path.is_absolute():
            path = Path(cwd) / path if isinstance(cwd, str) and cwd else None
        if path is None or path not in paths:
            paths.append(path)
        if len(paths) >= MAX_CANDIDATES:
            break
    return paths


def _read_brief(path: Path | None) -> str | None:
    if path is None:
        return None
    try:
        if not path.is_file() or path.stat().st_size > MAX_BRIEF_BYTES:
            return None
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None


def _criteria_missing(prompt: str, cwd: Any) -> bool | None:
    """True when the brief lacks criteria, False when it has them, None when it cannot be judged."""
    if _has_criteria(prompt):
        return False
    if re.search(r"<dispatch\b[^>]*>.*</dispatch\s*>", prompt, re.DOTALL):
        # An inline brief is the whole brief; paths inside it are materials, not the brief.
        return True
    candidates = _candidate_paths(prompt, cwd)
    if not candidates:
        # DECISION: an enforced role dispatched with neither an inline block nor a brief path
        # has no criteria anywhere, so it counts as missing rather than unknown.
        return True
    briefs = [text for text in map(_read_brief, candidates) if text is not None]
    if not briefs:
        return None
    # DECISION: check every readable candidate, not only the first, so a prompt that cites a
    # design doc before the brief path is not misjudged.
    return not any(_has_criteria(text) for text in briefs)


def main() -> int:
    try:
        parser = argparse.ArgumentParser()
        parser.add_argument("--mode", default=None)
        args = parser.parse_args()
        mode = _resolve_mode(args.mode)
        if mode == "off":
            return 0

        payload = json.load(sys.stdin)
        tool_input = payload["tool_input"]
        role = tool_input.get("subagent_type")
        # DECISION: tool_name is not re-checked; the hooks.json matcher already scopes this to Agent.
        if role not in ENFORCED_TYPES:
            return 0
        prompt = tool_input.get("prompt")
        if not isinstance(prompt, str):
            return 0
        if _criteria_missing(prompt, payload.get("cwd")) is not True:
            return 0

        message = MESSAGE.format(role=role)
        if mode == "strict":
            output = {
                "permissionDecision": "deny",
                "permissionDecisionReason": message,
            }
        else:
            # DECISION: advisory sends additionalContext with no permissionDecision, so the call
            # neither gets auto-allowed past the user's permission rules nor raises a prompt.
            output = {"additionalContext": message}
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", **output}}))
        return 0
    except BaseException:
        # A brief check must never block a dispatch because of malformed input or a script bug.
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
