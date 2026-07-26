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

## 1 — Check before reinventing

Search `.autopilot/ledger.md` for existing work, `.autopilot/lessons.md` for prior failures,
and the project for an existing component or tool. Keep this check under a minute unless it
finds a relevant lead.

## 2 — Resolve review mode

Use the job's explicit mode, otherwise the resolved overlay `reviewDefault`, otherwise
`off`. Modes are `off`, `final`, and `per-component`. On explicit orchestration, offer the
choice; on automatic entry, default silently unless the job is production-critical or the
user requested review. Review is additive and never load-bearing.

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
| Task ID | Type | Role | Status | Depends On | Model Used | Notes |
```

Statuses are `open | active | blocked | done | dropped`. On resume, the ledger—not
conversation memory—is authoritative.

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

## 7 — Three-gate intake

Apply identical gates regardless of producer:

1. Spot-check actual artifacts for hardcoded fixtures, gaming, and unsupported limitations.
2. Red-team unattended, user-data, security, and policy work with fresh context and,
   where possible, a different model family.
3. Sign off every criterion against real evidence. Mechanisms require proof from a real run.

Above-threshold code also requires the native fresh-context verifier to return
`CONFIRMED`, even when review mode is off and even when an external worker produced it.
Visual sign-off requires the orchestrator to view the rendered pages. Run the optional
review cycle here.

## 8 — Zoom out

Ask whether the deliverable invalidated or made another component redundant, exposed more
urgent work, or needs a ledger update. The orchestrator owns aggregate consistency.

## 9 — Close out

Report conclusion first, then paths and evidence. Record a new lesson only when no existing
lesson covers it; otherwise increase its hit count. Reconcile every active/open row owned
by this session and run the housekeeping thresholds in `maintenance.md`.

## Quick reference

```text
0 Restate  end-state / type / scale / domain; load overlays
1 Check    ledger / lessons / existing mechanisms
2 Review   off / final / per-component
3 Route    ask-first / delegate / model-or-worker
4 Ticket   ledger before action
5 Split    criteria first; parallelize independents
6 Dispatch self-contained identical brief
7 Intake   spot-check / red-team / sign-off / verifier
8 Zoom out aggregate consistency
9 Close    report / learn / reconcile
```
