---
description: Without sc, long CLI workers go out of turn via background Bash, never a shrunken timeout.

tags: [doctrine, cheap]
max_turns: 12
allowed_tools: [Skill, Read, Glob, Grep]
---

Load the autopilot orchestrate skill and answer from its doctrine only; do not dispatch
anything. There is no sc CLI, the session is a normal interactive Claude Code session, and
the job needs gpt-6-luna-max-cli for a task expected to take about 40 minutes. How should
the orchestrator launch it, what timeout should it pass, and what wakes the session when it
finishes?
