# Dispatch protocol

## Canonical dispatch block

Every native or external worker receives this self-contained shape:

```xml
<dispatch>
  <to>architect | engineer | engineer-doc | security-engineer | external worker id</to>
  <task_id>T-001</task_id>
  <depends_on>none | T-###</depends_on>
  <domain>code | document | analysis | design | research</domain>
  <system>Role identity and boundaries; sufficient if replayed elsewhere.</system>
  <context>Background, decisions, and upstream artifact paths.</context>
  <objective>One sentence describing the required artifact or outcome.</objective>
  <acceptance_criteria>
    - Concrete criterion with a verification method
  </acceptance_criteria>
  <output_format>Exact response and artifact shape.</output_format>
  <redlines>Files, actions, or decisions that must not change.</redlines>
  <materials>All specifications, fixtures, and upstream outputs by readable path.</materials>
</dispatch>
```

Write briefs longer than about 20 lines to `.autopilot/dispatch/T-###.md`. Prefer files to
large inline content. Agents have no shared memory; a missing material is a gap, not
permission to synthesize a substitute.

## Review block

```xml
<review>
  <task_id>T-001</task_id>
  <domain>code | document | analysis | design | research</domain>
  <deliverable>Full artifact or exact paths/diff.</deliverable>
  <spec>Authoritative design or specification.</spec>
  <criteria>Original acceptance criteria.</criteria>
  <instruction>
    Return structured critical | major | minor | nit findings with file/line evidence.
    No conversation and no edits.
  </instruction>
</review>
```

## Report contract

Return conclusions and artifact paths rather than large dumps. Include:

- What was done in at most five lines.
- Verification commands and key output.
- Limitations with evidence explaining why they remain.
- `IMPLEMENTATION NOTES` for implementers or `ASSUMPTIONS` for architects.

Source every factual or numeric claim.

## T1 — Design to architect

```xml
<dispatch>
  <to>architect</to>
  <task_id>T-001</task_id>
  <domain>design</domain>
  <system>You are the architect. Compare options and produce concrete interfaces, not production code.</system>
  <context>[complete background]</context>
  <objective>[design artifact]</objective>
  <acceptance_criteria>
    - Concrete interface types
    - At least two options with trade-offs
    - Risks and mitigations
  </acceptance_criteria>
  <output_format>Markdown design document</output_format>
  <redlines>[scope exclusions]</redlines>
  <materials>[specifications and prior decisions]</materials>
</dispatch>
```

## T2 — Implementation

Use `engineer` for code/data, `engineer-doc` for document/visual, and
`security-engineer` whenever security applies.

```xml
<dispatch>
  <to>engineer</to>
  <task_id>T-002</task_id>
  <depends_on>T-001</depends_on>
  <domain>code</domain>
  <system>Implement the authoritative design exactly. Do not redesign; record concerns in IMPLEMENTATION NOTES.</system>
  <context>[complete background and design path]</context>
  <objective>[implementation outcome]</objective>
  <acceptance_criteria>
    - Every required interface implemented
    - Relevant lint/compile/test checks pass
    - Named error paths exercised
  </acceptance_criteria>
  <output_format>Files plus evidence and IMPLEMENTATION NOTES</output_format>
  <redlines>[do-not-touch scope]</redlines>
  <materials>[design, references, real fixtures]</materials>
</dispatch>
```

Visual T2 criteria additionally require every created/changed page or slide rendered to
images and visually inspected, with viewed pages listed.

## T3 — Research to architect

```xml
<dispatch>
  <to>architect</to>
  <task_id>T-003</task_id>
  <domain>research</domain>
  <system>Investigate and recommend. Source claims, mark uncertainty, and never modify files.</system>
  <context>[decision this research informs]</context>
  <objective>[question]</objective>
  <acceptance_criteria>
    - Every option receives adopt, reject, or needs-user-decision
    - Every verdict has evidence
    - Uncertainty is explicit
  </acceptance_criteria>
  <output_format>Markdown research report</output_format>
  <redlines>Read-only</redlines>
  <materials>[starting sources]</materials>
</dispatch>
```

## T4 — Batch or refactor

```xml
<dispatch>
  <to>engineer</to>
  <task_id>T-004</task_id>
  <domain>code</domain>
  <system>Apply the specified pattern across scope. Skip and list ambiguous cases; never guess.</system>
  <context>[reason and scope]</context>
  <objective>[exact transformation]</objective>
  <acceptance_criteria>
    - Pattern applied consistently
    - Redlined files untouched
    - Before/after change list and skipped list
  </acceptance_criteria>
  <output_format>Changes, skips, and verification output</output_format>
  <redlines>[do-not-touch list]</redlines>
  <materials>[correct examples]</materials>
</dispatch>
```

## T5 — Arbitration

After round three still has blocking findings:

```xml
<dispatch>
  <to>architect</to>
  <task_id>T-005</task_id>
  <domain>[original domain]</domain>
  <system>Arbitrate after three failed review rounds. Return REDESIGN or OVERRIDE; justify the decision per finding.</system>
  <context>[design, latest artifact, every review round, every revision]</context>
  <objective>Resolve the disagreement finally.</objective>
  <acceptance_criteria>
    - Explicit REDESIGN or OVERRIDE
    - Replacement design, or finding-by-finding override rationale
  </acceptance_criteria>
  <output_format>Markdown arbitration decision</output_format>
</dispatch>
```

## T6 — External worker

The canonical brief remains unchanged; this wrapper records registry selection and intake.

```xml
<external_dispatch>
  <worker_id>registered-worker-id</worker_id>
  <model_family>registry modelFamily</model_family>
  <capability>code | refactor | test | review | docs | data | security | research</capability>
  <brief_path>[absolute .autopilot/dispatch/T-###.md path]</brief_path>
  <runner>~/.autopilot/bin/autopilot-worker</runner>
  <intake>spot-check + conditional red-team + criterion sign-off + native verifier for above-threshold code</intake>
</external_dispatch>
```

CLI invocation:

```text
~/.autopilot/bin/autopilot-worker run <worker-id> --brief <absolute-brief> --workdir <project-root>
```

Subagent records use the Agent tool. MCP records use the named MCP tool with resolved
`argsTemplate`. Normalize every result to `{ outcome, artifacts[], exit, evidence }`.

## sc-managed dispatch (super.engineering)

When startup detection found sc (CLI on PATH, `sc agents list --output json` succeeds),
role dispatches run as labeled sc agents instead of Agent-tool subagents. Registry `cli`
and `mcp` workers are unaffected. The brief is unchanged and fully self-contained: an sc
session carries no plugin agent frontmatter, so the `<system>` block is the entire role
identity, and every sc brief must state that the agent may not spawn further agents,
teams, or sessions.

1. Launch, first prompt only: `sc layout run panes ... --label t-###-<role> --output
   json` with the brief as the prompt. Consult `sc layout run --help` once per session
   for prompt-input flags; prefer file input for long briefs. Resolve
   `--provider/--model/--reasoning` from `sc layout capabilities --output json` plus the
   effort policy in `roles.md`; never invent a model id.
2. Wait synchronously in-turn: `sc agent wait --to label:t-###-<role> --idle
   --timeout-ms <N> --output json`. Do not rely on background notification.
3. Read the report with `sc agent read --to label:t-###-<role> --last <N> --output json`,
   then inspect the real artifacts on disk — the transcript is a claim, not evidence.
4. Follow-ups — retry with attached output, revision rounds, reviewer findings — go to the
   same agent via `sc agent send --to label:t-###-<role> --prompt <text> --queue
   --output json`, never a second `sc layout run` for the same worker.

`sc agents group create` plus `sc agent send --to group:<name>` may fan one shared
announcement to independent workers. `sc coordination-state get|set` (with `--if-version`
under concurrency) holds shared machine-readable decisions; the ledger remains
authoritative over coordination-state. Parallel code briefs with overlapping paths use
`sc worktree create --prompt <complete brief>` for true worktree isolation instead of
sharing the working tree.

sc dispatches produce no runner `meta.json`: capture `git rev-parse HEAD` before launch
and record it in the ledger, exactly as for native Agent-tool dispatches. Intake gates,
verification, escalation counts, and the checkpoint protocol are identical. Any sc
failure — launch error, wait timeout, unreadable session — falls through to the
Agent-tool native role or a registry worker with the same brief; log the degradation and
count the attempt against the same three-round cap.

## Checkpoint protocol

Before each dispatch, ensure the working tree is clean so failed work can be reverted:

1. Ensure `.autopilot/` is listed in the target project's `.gitignore` before the first
   stash or clean. Otherwise `git stash --include-untracked` removes briefs, the ledger,
   and artifacts from the working tree, and `git clean -fd` deletes them permanently.
2. If the tree is dirty with prior successful work, stash it:
   `git stash --include-untracked -m "autopilot: before T-###"`.
   In a repo with no commits, stash fails; skip the stash (and the reset protocol) when
   `baselineRef` is null.
3. Record the baseline ref. For CLI dispatches, read `baselineRef` from the runner's
   `meta.json`. For native Agent-tool and sc-managed dispatches, capture
   `git rev-parse HEAD` before dispatching and record it in the ledger's Notes column. A null baseline means no
   checkpoint was taken (non-git directory or repo before its first commit); skip reset.
4. On success and `CONFIRMED`: pop the autopilot stash if one was created. Select it by
   message: find the `stash@{n}` matching `autopilot: before T-###` via `git stash list`,
   then `git stash pop stash@{n}`. If the pop produces merge conflicts, resolve in favor
   of the worker's verified changes: `git checkout --theirs -- <conflicted paths>`,
   `git restore --staged <conflicted paths>`, then `git stash drop stash@{n}`.
5. On `REFUTED`, worker failure, or timeout: first reset tracked files, then clean untracked
   worker artifacts, then pop the stash. Order matters — cleaning before the pop is safe
   because stashed files live inside the stash object, not on disk.
   ```
   autopilot-worker reset --to <baselineRef> --workdir <root> --clean
   git stash pop stash@{n}   # select by autopilot message label
   ```
6. On escalation (second failure): reset and clean before handing to the next worker so it
   receives a clean tree, not debris from two failed attempts. Pop the stash after the
   escalated worker completes.
7. On dependent rollback (component A needs reverting after B built on it): reset to A's
   baseline ref, which also reverts B and any unrelated successful tasks committed between
   them. Re-dispatch both; note the collateral scope in the ledger.

The runner writes `changedFiles`, `untrackedFiles`, and `manifestComplete` to `meta.json`
after every CLI dispatch. `changedFiles` includes files the worker committed, not only
uncommitted modifications. `manifestComplete: false` means a git command failed or timed
out — the manifest is incomplete and should not be trusted for overlap analysis.

For sequential dispatch forensics, compare `changedFiles` across meta.json outputs to
identify which dispatch touched which files. Do not use this for parallel overlap
detection — in a shared working directory, concurrent runners see each other's changes and
produce misleading manifests. True parallel isolation requires worktree support.

## Escalation and practical rules

- First failure: retry the same worker with captured output and metadata in materials.
- Second failure: use the native engineer (security-engineer for security) with the full
  trail. Reset to the baseline ref before the first attempt so the native worker starts
  clean.
- A third attempt changes worker, approach, or model, or asks the user—never a blind retry.
- Independent briefs may dispatch in parallel; dependent briefs receive upstream artifacts.
- A dispatch has significant fixed context overhead (often tens of thousands of tokens);
  batch micro-work.
- Background processes need closed stdin, an explicit timeout, and deterministic output.
