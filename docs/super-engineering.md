# Better with super.engineering

Autopilot runs standalone on stock Claude Code, but it is built to sit on top of
[super.engineering](https://super.engineering) and its `sc` CLI, and that is the
recommended way to run it. Where sc is available it is the dispatch vehicle; Agent-tool
dispatch is the degradation, not the default.

The orchestrator probes once per job — `sc` on PATH and `sc agents list --output json`
succeeding — and if it answers, four things change:

- **Roles become real agents.** Each dispatch launches as a labeled sc agent
  (`t-###-<role>`) in its own pane through `sc layout run`, so you watch each role work
  instead of waiting on an opaque subagent. Follow-ups, retries, and review rounds go back
  to the same live agent with `sc agent send`.
- **Cross-family review stops being aspirational.** The adversarial panel resolves real
  providers from `sc layout capabilities` and deliberately seats a reviewer from a
  different family than the producer. That disjoint-findings result under
  [Field results](review.md#field-results) is what this buys.
- **Fan-out survives a headless session.** `sc agents get` resolves a callback address, so
  finished workers wake the dispatching session by queued message rather than by being
  waited on. Without one, a headless session keeps every dispatch in-turn.
- **True isolation when paths overlap.** Parallel code briefs touching the same files take
  `sc worktree create` instead of sharing one working tree — only ever on your explicit
  request.

None of it is required. Any sc failure, at probe time or mid-job, falls through to
Agent-tool dispatch with the same brief and logs the degradation. Registry `cli` and `mcp`
workers are unaffected either way.
