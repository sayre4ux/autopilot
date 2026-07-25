# Diagnosis

Use this when context cost, focus, or correctness starts degrading.

## Token leaks

- Oversized fieldwork in the orchestrator pollutes its context. Delegate above the scale
  threshold so only conclusions and paths return.
- Broad tool output floods context. Check size, read summaries/excerpts, then drill down.
- Micro-dispatches pay large fixed overhead. Batch small independent items or handle them
  directly.
- Bloated prompts duplicate rules. Keep each rule authoritative in one file and reference
  it elsewhere; keep long specifications in files.

## Focus loss

- A stated next action diverges from execution: write it to the ledger before announcing
  it and update the ledger before reordering.
- A new user message drops active work: answer the interruption, then check for a task
  still active and owned by the session.
- Individually correct components drift collectively: run command-loop Step 8 after every
  deliverable.

## Correctness failures

- A worker fabricates around unreadable materials: use self-contained briefs and
  three-gate intake; inspect actual artifacts even when tests pass.
- A documented mechanism is never wired: require a proof-of-life command and real artifact.
- Review rounds degrade into style churn: only critical/major findings trigger a new round,
  cap at three, then arbitrate.
- Model escalation becomes reflexive: first retry includes the failure trail; identical
  repeated errors call for an environment/approach fix, not a larger model.
- External pedigree becomes assumed quality: every worker re-enters identical intake and
  external-worker code always takes the verifier gate (R7 in `judgment.md`).
- The verifier becomes ritual: a second same-tier pass over clean native gate evidence is
  redundancy, not assurance. Apply R7, and when it skips, read the diff at spot-check.
- A retry or escalation inherits a polluted working tree: use the checkpoint protocol.
  Reset to `baselineRef` with `autopilot-worker reset --clean` before every retry or
  escalation so the next attempt starts from the same clean state the first attempt
  received. Pop any autopilot stash after the reset, not before. If `baselineRef` is null
  (no commits or non-git directory), the reset protocol is unavailable — work directly and
  accept the dirty-state risk.
