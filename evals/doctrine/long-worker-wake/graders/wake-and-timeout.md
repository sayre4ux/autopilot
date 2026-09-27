---
type: llm
---

PASS only if the answer launches the runner as a background Bash task (run_in_background)
rather than in the foreground, passes the record's own timeout (7200s) instead of shrinking
it to fit the Bash tool's 10-minute ceiling, and names Claude Code's task notification as
the wake. FAIL if it runs the worker in the foreground, lowers the timeout below the run
length, or says there is no way to be woken.
