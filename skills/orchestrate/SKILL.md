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
7. External outputs receive identical intake. The native fresh-context verifier runs when
   R7 in `references/judgment.md` fires — always for external-worker code — independent of
   review mode. Native-authored code with clean gate evidence relies on step-7 intake.
8. The orchestrator is a lean dispatcher, not a worker. Push heavy reading and file context
   into dispatches so the driving session stays small; never let it balloon into the work.
9. Never idle waiting and never leave work running with no wake signal. Every dispatch either
   returns inline or pings back to the callback address resolved at startup. Fan-out
   dispatches detached, marks its rows `awaiting`, and ends the turn; if no callback address
   resolved, dispatch synchronously instead. A vehicle whose wake is not listed in
   `references/dispatch.md` counts as no wake signal, and a sender-side `delivered`/`notified`
   flag is not a wake — block on the work or record its poll command in the row instead of
   promising a resumption you have not verified. See the callback section of
   `references/dispatch.md`.

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

Auto-entry is skill invocation, not dispatch authorization. On an auto-entered job the user
asked for the work and never asked for agents, and some Claude Code builds inject a
system-prompt line restricting Agent-tool calls to explicitly requested delegation — see
Degraded mode. That injection binds the Agent tool only, so it costs nothing when the vehicle
probe resolves sc or a registry worker. Explicit `/autopilot:orchestrate` satisfies the
condition outright.

## Startup

Read, if present, `~/.autopilot/config.jsonc`, then
`<project>/.autopilot/config.jsonc`; project values override global values. Tolerate
absence. Read worker records from both registry locations with project ids overriding
global ids. Apply role alias/effort overlays per `references/roles.md`: model as the Agent
tool's per-call override, effort via the definition frontmatter or sc `--reasoning`.

Run the dispatch-vehicle probe once per job, before the first dispatch: if the `sc` CLI is on
PATH and `sc agents list --output json` succeeds, super.engineering agent orchestration is
available and every role dispatch routes through the sc-managed path in
`references/dispatch.md`. sc is the vehicle whenever it is available — Agent-tool dispatch is
the degradation, not the default. If the probe fails, or any later sc call fails, fall
through to Agent-tool/registry dispatch and log the degradation with its reason; never retry
sc ritualistically. Record the result in the ledger header as `Vehicle:`; skipping the probe
and dispatching via the Agent tool by default is a harness failure, not a shortcut.

In the same detection pass, resolve the callback address that lets finished workers wake this
session: `sc agents get --to "id:chat:$SUPERCONDUCTOR_TERMINAL_ID" --output json`, usable only
when the read succeeds with `capabilities.send` and `capabilities.queue` true. Record it in
the ledger header as `Callback: chat:<terminal-id>`; on failure record `Callback: none` and
keep every dispatch synchronous. This matters most when the session is headless (`claude -p`):
the process exits at turn end, so a queued callback is the only thing that restarts it.

If the codebase-memory MCP is available, use it as the primary code-discovery tool for
this job. Before decomposition, ensure the target project is indexed: check `index_status`,
run `index_repository` once if it is absent, and `detect_changes` to refresh a stale index.
Prefer graph queries (`search_graph`/`search_code`, `trace_path`, `get_code_snippet`,
`get_architecture`) over grep sweeps for scoping and impact analysis, and every dispatch
brief tells its agent to do the same. Degrade to Explore/grep when the MCP is unavailable or
the project cannot be indexed; a missing index never blocks the loop.

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

Vehicle: sc | agent-tool (<reason if agent-tool>)
Callback: chat:<terminal-id> | none

| Task ID | Type | Role | Status | Depends On | Vehicle | Model Used | Notes |
|---|---|---|---|---|---|---|---|
```

`Vehicle` in the header is the probe result for the job; the per-row value is what that
dispatch actually used, so a mid-job degradation stays visible. A missing header line means
the probe never ran — run it before dispatching rather than assuming `agent-tool`. Mark an
auto-entered job that degraded to the Agent tool `agent-tool (suppressible)` per Degraded
mode.

Statuses: `open | active | awaiting | blocked | done | dropped`. `awaiting` means the work is
running elsewhere and a callback will wake this session; record the callback target, dispatch
mode, and expected duration in Notes. Notes hold state and pointers, not narrative: when the
project keeps a root `DEVLOG.md`, history goes there as `see DEVLOG §N` (devlog section of
`references/maintenance.md`).

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

Pass `--callback <target>` to CLI workers whenever an address resolved, adding `--detach`
when fanning out or when the worker will run for minutes; then end the turn rather than
waiting. sc-managed role dispatches carry the `<callback>` block inside the brief. Agent-tool
and MCP dispatches are synchronous and need nothing.

First external failure receives one retry with output and metadata attached. A second
failure routes to native engineer, or security-engineer for security work. Record every
worker id/model family or native alias/effort in the ledger.

At intake, spot-check for gaming, red-team when warranted, sign off every criterion using
actual evidence, and run the native verifier when R7 fires. Optional review then runs per
`references/review-cycle.md`: an adversarial panel of at least two independent reviewers at
the final gate, preferring distinct model families, degrading to a solo native reviewer.

## Degraded mode

An empty worker registry, missing runner, missing external CLI, or unavailable review
worker must not break the harness. Fall through to native roles and log why. If only one
model alias is available, preserve role separation, reduce parallelism, strengthen briefs,
and pass that alias explicitly to each native dispatch.

Agent-tool dispatch has a suppression mode the other vehicles do not. Claude Code can carry a
system-prompt line restricting Agent-tool calls to delegation the user asked for, and it
outranks this skill and any `CLAUDE.md`. On an auto-entered job it can turn an intended
dispatch into silent inline work. Log `Vehicle: agent-tool (suppressible)` when the job both
degraded to the Agent tool and auto-entered, so a dispatch that never fired reads differently
from one that was never planned. Two suppressed dispatches count as the two failures in Hard
rule 1 — fall through to a registry worker, or state the delegation to the user and let them
authorize it, rather than restating the policy louder.

An unresolvable callback address is a degradation, not a failure: log `Callback: none`, drop
`--detach`, and run every dispatch synchronously in-turn. A delivered-false callback in
`meta.json` means that task's wake was lost — reconcile it by reading the artifacts directly
rather than waiting for a ping that will not come.
