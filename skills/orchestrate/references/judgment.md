# Judgment rubrics

Use these mechanically. If none resolves the choice, it is a genuine taste call.

## R1 — Escalate the model or role

Escalate when the same subtask failed twice for different reasons, two rule sources must be
traded off, the task changes a protected/core layer, or user intent cannot be grounded in a
specific instruction or ticket. Repeated identical failure is usually environmental:
change the environment or approach instead.

Positive example: after two distinct unusable implementations, ask the architect to rethink
the approach, then push the resulting execution back to engineering.

Negative example: escalating a minor formatting defect to architecture.

## R2 — Done

All must hold:

1. Every criterion has command output or a concrete artifact.
2. A mechanism has proof from one successful real run.
3. The ledger row is backfilled.
4. Every promise to the user is reported or explicitly rescheduled.

A dry-run alone does not prove a scheduled job, hook, or service works.

## R3 — Ask the user

Ask for irreversible/destructive action without standing authorization, a choice based on
values rather than technical merit, a scope/direction change to committed work, or a
contradiction between the instruction and observed facts. Decide ordinary technical
placement and implementation choices yourself.

## R4 — Change the approach

Stop retrying when the error category remains after two attempts, fixes cause divergence,
a third special case is needed, or the environment presents the same wall for a third
time. A third attempt must change worker, approach, model tier, or ask the user.

## R5 — Minimum gates

| Deliverable | Gates |
|---|---|
| Code module | Lint + compile + one real run |
| Script | Syntax check + dry-run + real run |
| Document/report | Claims verified + structure checked + proofread |
| Rules/policy | Contradiction search + red-team + read-back |
| Unattended automation | Relevant gates + side-effect check + real run |
| Any dispatched output | Artifact spot-check + criterion sign-off; verifier per R7 |
| Numeric/factual claim | Source, or explicitly `unverified` |

## R6 — Taste

For tone, style, inferred preference, or equally correct alternatives:

1. Search prior user decisions.
2. Produce two or three candidates and have fresh context score them against
   pre-registered criteria.
3. If still unresolved, present the actual taste choice to the user rather than guessing.

## R7 — Fresh-context verifier gate

This rubric is the single source of truth for when the native `verifier` runs. `SKILL.md`,
`command-loop.md`, and `workers.md` point here; do not restate the condition in those files.

The verifier gates claims the orchestrator cannot check cheaply itself. It is not a routine
step: an opus-class author already verifies its own work and reports gate evidence, so a
second same-tier pass over clean evidence buys redundancy rather than assurance.

Dispatch the verifier when any of these holds:

1. An external worker produced the code. Cross-family output is unattested by construction.
2. The work is security-sensitive, unattended automation, or production-critical.
3. Reported evidence lacks output from one real run, or a criterion rests on assertion.
4. The spot-check found a hardcoded fixture, a silently narrowed scope, or other gaming.
5. This is retry round two or later on the same component.

Otherwise the three-gate intake in `command-loop.md` step 7 stands alone. Record
`verifier: skipped (R7)` in the ledger row. Skipping shifts weight onto the artifact
spot-check: read the diff itself, never the report alone.

## R8 — Supervisor gate

This rubric is the single source of truth for when the `supervisor` runs. It judges the job,
not a deliverable, and it is the most expensive role per call, so it runs at gates only.

Dispatch the supervisor when any of these holds:

1. **Plan gate.** Decomposition (command-loop step 5) produced a multi-component or multi-day
   plan. Run it once, before the first dispatch.
2. **Milestone gate.** A multi-component job reaches a point where you would check in with the
   user: a wave of tasks is done and the next wave depends on it.
3. **Escalation gate.** R4 fires and the failure is not plainly environmental. Run it before
   choosing the changed approach, so the third attempt is aimed at the cause.
4. **Final gate.** A multi-component job, or any job with review mode on, is about to close
   out (step 9). Run it after intake and review, before reporting done.

Single-component and trivial jobs skip it; record `supervisor: skipped (R8)`.

Brief it goal-first: the user's goal in their words, the gate, the ledger, and pointers to the
artifacts that carry weight. Do not hand it a checklist — it decides what matters at this
gate. Security tasks go in as summaries; see the Fable section of `roles.md`.

Act on the verdict and record it in the ledger row:

- `ON-TRACK`: continue.
- `DRIFT`: fix the plan or the routing, record what changed, then continue. A finding you
  decline to act on is recorded with the reason.
- `STOP`: ask the user (R3) with the supervisor's stated decision, and dispatch nothing that
  depends on it until they answer.
