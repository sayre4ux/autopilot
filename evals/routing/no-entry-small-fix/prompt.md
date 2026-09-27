---
description: A one-file fix is below threshold and must not auto-enter orchestration.
tags: [routing, cheap]
max_turns: 6
allowed_tools: [Skill, Read, Glob, Grep]
---

This Python function should return the median of a non-empty list but is wrong for
even-length input. Reply with the corrected function only.

def median(xs):
    s = sorted(xs)
    return s[len(s) // 2]
