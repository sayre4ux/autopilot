#!/usr/bin/env python3
"""Fail-open Claude Code hook for a small set of catastrophic Bash commands."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import shlex
import sys
from typing import Any


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

    if _rm_recursive_force_root_or_home(normalized):
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


def _rm_recursive_force_root_or_home(command: str) -> bool:
    for segment in re.split(r"\s*(?:&&|\|\||[;&|])\s*", command):
        if not segment:
            continue
        try:
            tokens = shlex.split(segment)
        except ValueError:
            tokens = segment.split()
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
            if recursive and forced and token in {"/", "~"}:
                return True
    return False


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
                    import re as _re
                    text = _re.sub(r"//[^\n]*", "", config.read_text(encoding="utf-8"))
                    mode = json.loads(text).get("enforcement", "advisory")
                except Exception:
                    pass
            if mode not in {"off", "advisory", "strict"}:
                mode = "advisory"
        if mode == "off":
            return 0

        payload = json.load(sys.stdin)
        reason = _catastrophic_reason(_command_from(payload))
        if reason is None:
            return 0

        print(f"Autopilot Bash guard: {reason}.", file=sys.stderr)
        return 2 if mode == "strict" else 0
    except BaseException:
        # Hooks must never brick Bash because of malformed input or a script/platform bug.
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
