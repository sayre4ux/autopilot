# Command loop

This is the execution order for every non-trivial Autopilot job.

## 0 — Restate the job

State four things before action:

1. End-state: the outcome the user needs, not merely the requested action.
2. Type: Build, Change, Research, Review, Look-up, or Decide (the last belongs to the user).
3. Scale: trivial, single-component, multi-component, or multi-day.
4. Domain: code, document, analysis, design, or research. Classify mixed work per component.

At the same time, read optional global and project overlays in the load order documented
in `workers.md`. Absence is normal.

Then run the dispatch-vehicle probe once, before any other step: `sc agents list --output
json`. Success means sc-managed orchestration per the sc section of `dispatch.md` is the
vehicle for every role dispatch this job; failure or a missing CLI means Agent-tool
dispatch. Resolve the callback address in the same pass (`SKILL.md` startup). Record the
outcome in the ledger header as `Vehicle: sc | agent-tool` with the reason on failure. An
absent `Vehicle:` line means the probe was skipped — run it before dispatching, never assume
Agent-tool.

## 1 — Check before reinventing

Search `.autopilot/ledger.md` for existing work, `.autopilot/lessons.md` for prior failures,
and the project for an existing component or tool. Keep this check under a minute unless it
finds a relevant lead.

## 2 — Resolve review mode

Use the job's explicit mode, otherwise the resolved overlay `reviewDefault`, otherwise
`off`. Modes are `off`, `final`, and `per-component`. On explicit orchestration, offer the
choice; on automatic entry, default silently unless the job is production-critical or the
user requested review. Review is additive and never load-bearing. When review runs, the
final gate is the adversarial panel in `review-cycle.md` — at least two independent
reviewers whose findings are merged and cross-scored.

## 3 — Route

Pass these gates in order:

1. Ask first only for irreversible/destructive action, a values-level fork, scope conflict,
   or contradiction with an observed fact.
2. Delegate when isolation, parallelism, or scale buys value: more than three files, more
   than 200 changed lines, or multi-component design. Work directly below threshold, where
   deciding context already lives in the session, for urgent fixes, or after two failed
   dispatches. Document/visual/prose work never auto-enters; explicit orchestration routes
   implementation to `engineer-doc`.
3. Choose the role or worker and record its model alias/effort or worker family. Match model
   tier to task tier; reserve the top tier for work that needs it. Delegating heavy file
   context into the dispatch keeps the orchestrator session lean — a cost lever, not only a
   quality one (see the cost-and-context discipline section in `SKILL.md`).

## 4 — Open a ticket

For work above trivial, create or update a ledger row before starting:

```markdown
| Task ID | Type | Role | Status | Depends On | Vehicle | Model Used | Notes |
```

`Vehicle` is `sc` or `agent-tool` (or the registry worker's runner for CLI/MCP dispatch) —
what this dispatch actually used, so a degradation away from the header's job-level vehicle
is visible per row.

Statuses are `open | active | awaiting | blocked | done | dropped`. `awaiting` means the
work is running elsewhere and a callback will wake this session; its Notes hold the callback
target, dispatch mode, and expected duration. On resume — including a resume triggered by a
callback into a cold process — the ledger, not conversation memory, is authoritative.

## 5 — Decompose acceptance-first

Break the end-state into independently verifiable components. Write acceptance criteria
before method; split components whose criteria remain vague. Mark dependencies and run
independent work in parallel. Assign design to architect, code/data implementation to
engineer, document/visual implementation to engineer-doc, and security-sensitive work to
security-engineer. Split design plus implementation into sequential tasks.

Every changed page/slide in a visual deliverable must be rendered to an image and visually
inspected. Text-presence checks do not satisfy that criterion.

## 6 — Dispatch

On first non-trivial use, verify that `.autopilot/` is listed in the target project's
`.gitignore`. The checkpoint protocol's stash and clean operations will destroy briefs,
ledger state, and artifacts if `.autopilot/` is untracked by git.

Ensure the working tree is clean before dispatching. If it contains uncommitted work from a
prior successful task, stash it with the autopilot message label. Follow the checkpoint
protocol in `dispatch.md` so every dispatch starts from a known baseline and failed work
can be reverted mechanically with `autopilot-worker reset`. For native Agent-tool
dispatches, capture the baseline ref yourself since no runner meta.json is produced.

Choose native versus external execution using `workers.md`; when startup detection found
sc-managed orchestration, native-role dispatches take the sc path in `dispatch.md`. Then
fill the matching template in `dispatch.md`. External and native workers receive the same self-contained brief at
`.autopilot/dispatch/T-###.md`. Check goal/motivation, concrete criteria, exact output,
redlines, and all required materials. Long specifications remain files.

Then choose how the result comes back, per the callback section of `dispatch.md`. One short
dispatch runs synchronously. A fan-out of two or more workers, or any worker expected to take
minutes, dispatches with a callback — `--detach --callback` for CLI workers, the brief's
`<callback>` block for sc agents — sets each row to `awaiting`, and ends the turn. Never poll
and never idle the session; equally, never detach work when no callback address resolved,
because an unwakeable session loses the result entirely.

## 6a — Wake

A callback re-enters here, possibly in a cold process. Reconcile the ledger before anything
else, then run step 7 for the announced task id alone. Leave other `awaiting` rows awaiting
and end the turn again — the final callback is the one that reaches close-out. For a row that
has gone quiet past its expected duration, probe rather than guess: `kill -0 <pid>` from its
`.pending.json` for a CLI worker, `sc agent wait --idle` for an sc agent. A dead process with
no callback is a failed dispatch and takes the normal escalation path.

## 7 — Three-gate intake

Apply identical gates regardless of producer:

1. Spot-check actual artifacts for hardcoded fixtures, gaming, and unsupported limitations.
   Read the diff itself, never the report alone — when R7 skips the verifier this is the
   only independent read of the code.
2. Red-team unattended, user-data, security, and policy work with fresh context and,
   where possible, a different model family.
3. Sign off every criterion against real evidence. Mechanisms require proof from a real run.

Code additionally requires the native fresh-context verifier to return `CONFIRMED` whenever
R7 in `judgment.md` fires, independent of review mode. External-worker code always fires R7.
Visual sign-off requires the orchestrator to view the rendered pages. Run the optional
review cycle here.

## 8 — Zoom out

Ask whether the deliverable invalidated or made another component redundant, exposed more
urgent work, or needs a ledger update. The orchestrator owns aggregate consistency.

## 9 — Close out

Report conclusion first, then paths and evidence. Record a new lesson only when no existing
lesson covers it; otherwise increase its hit count. Reconcile every active/open/awaiting row
owned by this session — close out only when none remain awaiting — and run the housekeeping
thresholds in `maintenance.md`.

If the project has a root `DEVLOG.md`, maintain it per the devlog section of
`maintenance.md`: append one numbered entry for this job with verification evidence, and
rewrite the State header to current facts. Ledger Notes then carry pointers
(`see DEVLOG §N`), not narrative. Never create a devlog uninvited.

## Quick reference

```text
0 Restate  end-state / type / scale / domain; load overlays
1 Check    ledger / lessons / existing mechanisms
2 Review   off / final / per-component
3 Route    ask-first / delegate / model-or-worker
4 Ticket   ledger before action
5 Split    criteria first; parallelize independents
6 Dispatch self-contained identical brief; sync or callback+detach, then end the turn
6a Wake   reconcile ledger / intake the announced task only
7 Intake   spot-check / red-team / sign-off / verifier per R7
8 Zoom out aggregate consistency
9 Close    report / learn / reconcile / devlog entry + State rewrite
```
