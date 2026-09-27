#!/usr/bin/env python3
"""Fail-open Claude Code hook for a small set of catastrophic Bash commands.

Strict mode denies the call; advisory mode asks the user. Both go out as a PreToolUse
permission decision on stdout, because exit-0 stderr is never shown to the model.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import shlex
import sys
from typing import Any


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


def _command_from(payload: Any) -> str:
    if not isinstance(payload, dict):
        raise TypeError("hook input must be an object")
    tool_input = payload.get("tool_input", payload)
    if not isinstance(tool_input, dict):
        raise TypeError("tool_input must be an object")
    command = tool_input.get("command")
    if not isinstance(command, str):
        raise TypeError("tool_input.command must be a string")
    return command


def _catastrophic_reason(command: str) -> str | None:
    normalized = " ".join(command.strip().split())

    if any(_rm_recursive_force_root_or_home(line) for line in command.splitlines()):
        return "recursive forced removal of / or ~"

    if (
        re.search(r"\bgit\s+push\b", normalized, re.IGNORECASE)
        and re.search(r"(?:--force(?:-with-lease)?|-f)\b", normalized)
        and re.search(r"\b(?:main|master|refs/heads/(?:main|master))\b", normalized)
    ):
        return "force-push to a protected ref"

    if re.search(r"\bgit\b[^;&|\n]*\s--no-verify\b", normalized, re.IGNORECASE):
        return "git command bypassing verification"

    if (
        re.search(r"\b(?:drop|truncate)\s+(?:table|database|schema)\b", normalized, re.IGNORECASE)
        and not re.search(r"\bwhere\b", normalized, re.IGNORECASE)
    ):
        return "destructive SQL without a WHERE guard"

    return None


def _root_or_home_targets() -> set[str]:
    targets = {"/", "/*"}
    for home in ("~", "$HOME", "${HOME}", str(Path.home())):
        targets |= {home, f"{home}/", f"{home}/*"}
    return targets


def _rm_recursive_force_root_or_home(command: str) -> bool:
    targets = _root_or_home_targets()
    for segment in re.split(r"\s*(?:&&|\|\||[;&|])\s*", command):
        if not segment:
            continue
        try:
            tokens = shlex.split(segment)
        except ValueError:
            tokens = segment.split()
        while tokens and (
            tokens[0] in {"sudo", "command", "builtin", "env"}
            or re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", tokens[0])
        ):
            tokens = tokens[1:]
        if not tokens or tokens[0].lower() != "rm":
            continue

        recursive = False
        forced = False
        end_of_options = False
        for token in tokens[1:]:
            if token == "--" and not end_of_options:
                end_of_options = True
                continue
            if not end_of_options and token.startswith("--"):
                recursive = recursive or token == "--recursive"
                forced = forced or token == "--force"
                continue
            if not end_of_options and token.startswith("-") and token != "-":
                flags = token[1:].lower()
                recursive = recursive or "r" in flags
                forced = forced or "f" in flags
                continue
            if recursive and forced and token in targets:
                return True
    return False


def main() -> int:
    try:
        parser = argparse.ArgumentParser()
        parser.add_argument("--mode", default=None)
        args = parser.parse_args()
        mode = _resolve_mode(args.mode)
        if mode == "off":
            return 0

        payload = json.load(sys.stdin)
        reason = _catastrophic_reason(_command_from(payload))
        if reason is None:
            return 0

        # Exit-0 stderr never reaches the model, so the verdict goes out as a permission
        # decision: strict denies the call, advisory puts it in front of the user.
        decision = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny" if mode == "strict" else "ask",
                "permissionDecisionReason": f"Autopilot Bash guard: {reason}.",
            }
        }
        print(json.dumps(decision))
        return 0
    except BaseException:
        # Hooks must never brick Bash because of malformed input or a script/platform bug.
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
