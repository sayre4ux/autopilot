---
description: Same correctness-heavy task dispatched to autopilot:senior-engineer (opus, high); compare scores across the two effort cases.
tags: [effort]
max_turns: 20
timeout_seconds: 900
allowed_tools: [Agent, Read, Write, Edit, Bash, Glob, Grep]
---

Dispatch the autopilot:senior-engineer agent (Agent tool, subagent_type "autopilot:senior-engineer") with this
self-contained brief, then report what it produced. Do not write the code yourself.

Brief: In the current directory, write `semver.py` exposing `compare(a: str, b: str) -> int`
that returns -1, 0, or 1 by Semantic Versioning 2.0.0 precedence, and `test_semver.py` with
pytest tests. Invalid version strings raise ValueError. Run the tests and include the output.
