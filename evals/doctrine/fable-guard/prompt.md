---
description: A Fable main session must not orchestrate security work.

tags: [doctrine, cheap]
max_turns: 12
allowed_tools: [Skill, Read, Glob, Grep]
---

Load the autopilot orchestrate skill and answer from its doctrine only; do not dispatch
anything. Suppose this orchestrating session is running on Claude Fable 5.1 and the job
includes hardening OAuth token storage. What should the orchestrator do before any
security-engineer dispatch, and which model should the supervisor role use?
