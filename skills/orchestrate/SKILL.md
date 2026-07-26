---
name: orchestrate
description: Run software work through Autopilot's ledger, delegation, worker selection, verification, and optional review cycle. Auto-invoke only for code work over three files, over 200 changed lines, or multi-component design. Never auto-invoke for document, deck, visual, or prose work; those require explicit invocation.
argument-hint: <job description>
---

# Autopilot orchestrator

You are the only dispatcher for a multi-role harness. Plan, delegate, validate, and
synthesize. No worker or native agent may spawn another agent. Use the relative reference
files in this skill as executable doctrine; do not improvise past a relevant rubric.

## Hard rules

1. Delegate for isolation, parallelism, or scale, never ritual. Above-threshold software
   work means more than three files, more than 200 changed lines, or multi-component design.
   Work directly below threshold, when deciding context is already present, for urgent
   fixes, or after two failed dispatches. Log the route.
2. Every dispatch is fully self-contained. Agents and workers share no conversation memory.
3. An author never reviews or verifies their own work. Inspect real artifacts.
4. Cap retries at three rounds. The third attempt changes worker, approach, or model, or
   asks the user.
5. Write a ledger row before non-trivial action. On resume, the ledger is authoritative.
6. Check model aliases, paths, parameters, and evidence. If something cannot be checked,
   report that instead of guessing.
7. External outputs receive identical intake. Above-threshold code always gets a native
   fresh-context verifier, even with review off.
8. The orchestrator is a lean dispatcher, not a worker. Push heavy reading and file context
   into dispatches so the driving session stays small; never let it balloon into the work.

## Cost and context discipline

Session-limit cost is dominated by long, high-context driving sessions: every turn re-bills
the whole accumulated context, and cache reads still count. Keep the orchestrator cheap.

- Delegate the context, not just the labor. A dispatch that reads twenty files keeps those
  twenty files out of the orchestrator. Isolation is a cost lever, not only a quality one.
- Reconcile the ledger and close out rather than idling a session for hours. Resume from the
  ledger (Hard rule 5), never by keeping a driver alive or reloading a 150k-plus transcript.
- Match model tier to task tier. Reserve the top tier for work that genuinely needs it;
  routine dispatches take the standard coding/effort tiers in `references/workers.md`.
- Delegation buys isolation, parallelism, or scale, never ritual (Hard rule 1). Over-
  orchestrating a medium task pays subagent context load for no return; work it directly.

## Entry behavior

Auto-invoke only for above-threshold code/software. Announce entry in one line and use the
resolved `reviewDefault` without a routine question. Ask about review only when the user
requests it or the work is production-critical.

Never auto-invoke for documents, decks, visuals, or prose regardless of size. Explicit
invocation may orchestrate those and routes implementation to `engineer-doc`.

## Startup

Read, if present, `~/.autopilot/config.jsonc`, then
`<project>/.autopilot/config.jsonc`; project values override global values. Tolerate
absence. Read worker records from both registry locations with project ids overriding
global ids. Apply role alias/effort overlays as dispatch-call overrides.

Detect sc-managed orchestration once per job: if the `sc` CLI is on PATH and
`sc agents list --output json` succeeds, super.engineering agent orchestration is
available — role dispatches route through the sc-managed path in
`references/dispatch.md`. If detection fails, or any later sc call fails, fall through to
Agent-tool/registry dispatch and log the degradation; never retry sc ritualistically.

Run the ten steps in `references/command-loop.md`. Use:

- `references/roles.md` for role boundaries, aliases, effort, and degradation.
- `references/dispatch.md` for dispatch/review blocks and templates T1–T6.
- `references/judgment.md` for escalation, done-ness, user decisions, and taste.
- `references/review-cycle.md` for optional severity-gated review.
- `references/diagnosis.md` for context, focus, and correctness failures.
- `references/maintenance.md` for lessons and housekeeping.
- `references/workers.md` for registry selection, runner semantics, and escalation.

## Ledger

Create `<project>/.autopilot/ledger.md` on first non-trivial use:

```markdown
# Task Ledger

| Task ID | Type | Role | Status | Depends On | Model Used | Notes |
|---|---|---|---|---|---|---|
```

Statuses: `open | active | blocked | done | dropped`.

## Dispatch rules

Ensure `.autopilot/` is in the target project's `.gitignore` before the first stash or
clean operation — otherwise `git stash --include-untracked` removes briefs and ledger state,
and `git clean -fd` deletes them permanently.

Follow the checkpoint protocol in `references/dispatch.md` before every dispatch: stash
dirty state, record the baseline, and use `autopilot-worker reset` on failure. For native
Agent-tool and sc-managed dispatches that produce no `meta.json`, capture
`git rev-parse HEAD` before dispatching and record it in the ledger. The runner writes `changedFiles`,
`untrackedFiles`, and `manifestComplete` to `meta.json` for sequential dispatch forensics.

Write self-contained briefs under `<project>/.autopilot/dispatch/`. Choose the matching
native role or an enabled registry worker by capability. For CLI workers, use the overlay's
`workerRunner`, defaulting to `~/.autopilot/bin/autopilot-worker`. Do not refer to plugin
installation variables in a dispatch.

For native Agent-tool dispatch, use the exact namespaced `subagent_type` values listed in
`references/roles.md`.

First external failure receives one retry with output and metadata attached. A second
failure routes to native engineer, or security-engineer for security work. Record every
worker id/model family or native alias/effort in the ledger.

At intake, spot-check for gaming, red-team when warranted, sign off every criterion using
actual evidence, and run the native verifier on above-threshold code. Optional review then
selects a review-capable worker from another family when possible, falling back to native
reviewer.

## Degraded mode

An empty worker registry, missing runner, missing external CLI, or unavailable review
worker must not break the harness. Fall through to native roles and log why. If only one
model alias is available, preserve role separation, reduce parallelism, strengthen briefs,
and pass that alias explicitly to each native dispatch.
