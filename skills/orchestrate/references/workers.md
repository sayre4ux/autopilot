# External worker layer

External workers are optional execution routes. Native agents remain the guaranteed floor.
Worker pedigree never bypasses intake, and external-worker code always takes the verifier
gate (R7 in `judgment.md`).

## Registry and precedence

Records are individual JSON files:

1. `~/.autopilot/workers/*.json` — user-global.
2. `<project>/.autopilot/workers/*.json` — project records override global records by `id`.

Records follow `workers/registry.schema.json`. The orchestrator handles `subagent` and
`mcp`; `~/.autopilot/bin/autopilot-worker` executes `cli`.

## Overlay precedence

Read on every job, tolerating absence:

1. Shipped agent frontmatter.
2. `~/.autopilot/config.jsonc`.
3. `<project>/.autopilot/config.jsonc`.

Higher-level keys replace lower-level values; absent keys inherit. Overlays may change
per-role alias/effort, `reviewDefault`, `reviewPanelSize` (final-gate reviewer count,
default 2, minimum 1), worker enablement/order, `workerRunner`, and
`callbacks` (`mode`: `auto` | `off`; `detachThresholdSec`). They cannot select the
main-session model.

## Selection

Match task need to `capabilities`. Exclude disabled records and heed `avoidWhen`; use
`preferWhen` and overlay order as tie-breakers. For review, prefer a different
`modelFamily`. If no record matches or invocation is unavailable, select the corresponding
native role.

A `modelFamily` that names no real family — `omp-configured` and anything else resolved from
local configuration rather than the record — is not evidence of independence. When such a
record is the *producer*, its opaque value differs from every real family string, so the panel
would seat a reviewer it merely assumes is independent. Resolve the actual family first (for
omp, `modelRoles.default` in `~/.omp/agent/config.yml`), seat the reviewer against that, and
log the resolved family in `Model Used`. If it cannot be resolved, treat the producer's family
as unknown and prefer a native reviewer whose family you do know.

Log worker id plus family in `Model Used`, for example `code-worker (external-family)`.

## CLI contract

```text
autopilot-worker run <worker-id>
  --brief <absolute-path>
  --workdir <project-root>
  [--out <directory>]
  [--timeout <seconds>]
  [--yes]
  [--callback <sc-target>]
  [--detach]

autopilot-worker reset
  --to <git-ref>
  --workdir <project-root>
  [--clean]
```

The `run` subcommand resolves project over global registry records. The runner substitutes
`${task_id}`, `${brief_path}`, `${prompt}`, `${workdir}`, `${output_dir}`, and
`${output_file}` without a shell. `trusted: false` exposes the resolved command for
approval; `--yes` is reserved for an already approved invocation.

The `reset` subcommand validates the ref as a commit, runs `git reset --hard`, and
optionally `git clean -fd -e .autopilot/` with `--clean`. The exclusion keeps the ledger,
briefs, and artifacts alive even in a project that never gitignored them — it is a backstop,
not a licence to skip the `.gitignore` step, which still protects them from `git stash
--include-untracked` and from any hand-run `git clean`. It assumes `--workdir` is the git
repository toplevel; behavior in a subdirectory of an enclosing repo is undefined — document
the monorepo case if it arises.

Runner exits:

- `0`: success (`run`: allowed worker exit and expected output; `reset`: completed).
- `2`: worker exit or expected output failed (`run` only).
- `3`: registry, record, command, or ref error (both subcommands).
- `4`: untrusted command declined (`run` only).
- `124`: timeout and process termination (`run` only).

`--callback` names the sc target to wake when the run finishes; the runner sends it on every
exit path, including timeout and registry error, and the send never changes the run's exit
code. `--detach` re-execs the runner in its own session and returns 0 immediately, making the
callback the only result channel — it therefore requires `--callback`, and requires `--yes`
for an untrusted record because a detached process cannot prompt for approval. Full protocol,
including who pings back for each vehicle and the turn discipline it enables, is in
`dispatch.md`.

It writes `<out>/<task-id>.out` and `<out>/<task-id>.meta.json`. Metadata records worker,
resolved command, worker exit, duration, timeout state, output byte count, `baselineRef`,
`changedFiles`, `untrackedFiles`, `manifestComplete`, and `callback`
(`{ target, idempotencyKey, delivered, error }`, or `null` when none was requested). A
`delivered: false` callback means the wake was lost and that task will never announce itself.
A detached run additionally writes `<out>/<task-id>.pending.json` while it is alive and a
`<task-id>.pending.detached.log` holding the runner's own stderr; the pending marker carries
the pid, so a quiet task is probed with `kill -0 <pid>` rather than guessed at.
`changedFiles` includes files the
worker committed (via `baseline..HEAD` diff), not only uncommitted modifications.
`manifestComplete: false` means a git command failed or timed out; the manifest is
incomplete and should not be used for overlap analysis.

For `output.channel: "worktree"`, the result is the list of paths the run touched, compared
against a pre-run snapshot of the same pointer. Three rules make that list mean something:
hidden paths count, so work confined to `.github/` or `.gitignore` is visible; a removal is
reported as `deleted: <path>`, so a delete-only task is not an empty result and therefore not
a failed run; and paths the repository ignores are dropped, so a worker that produced nothing
but `__pycache__` or another build artifact fails instead of reporting success. Repository
internals (`.git`, `.hg`, `.svn`) are never results. A deliberately ignored file that *is* the
deliverable needs `channel: "file"` with an explicit `resultPointer`, because the ignore
filter would otherwise discard it.

The reset subcommand wraps `git reset --hard` and `git clean -fd` inside deterministic
Python to avoid relying on LLM judgment for destructive operations. This intentionally
bypasses PreToolUse Bash hooks — a user relying on hook-level protection for all resets
should be aware that `autopilot-worker reset` executes directly. The subcommand has no
`--dry-run`; the orchestrator should log the ref and workdir before invoking it.

## Dispatch paths

- sc: when startup detection found super.engineering orchestration (`sc` on PATH and
  `sc agents list --output json` succeeds), role dispatches run as labeled sc agents per
  the sc-managed section of `dispatch.md`. This replaces the Agent-tool vehicle for
  native roles only; registry `cli` and `mcp` records dispatch unchanged. Any sc failure
  falls through to the Agent tool with the same brief — native agents stay the floor.
- CLI: invoke the installed runner.
- Subagent: the record's `subagentType` must name a plugin role as
  `autopilot:architect`, `autopilot:engineer`, `autopilot:engineer-doc`,
  `autopilot:security-engineer`, `autopilot:verifier`, or `autopilot:reviewer`; pass that
  exact value to the Agent tool as `subagent_type`, applying overlay-resolved model/effort
  overrides.
- MCP: resolve placeholders recursively in `argsTemplate`, call `tool`, and extract
  `resultField`.

Normalize all paths to `{ outcome, artifacts[], exit, evidence }`.

Wake responsibility differs by path. Agent-tool and MCP dispatch are synchronous — the tool
return is the ping. CLI dispatch takes `--callback`, and `--detach` when fanning out. The sc
path carries the callback instruction inside the brief. See the callback section of
`dispatch.md`; no path may end a turn with work running and no wake signal.

## Intake and escalation

All workers receive the identical self-contained brief. On return:

1. Spot-check the artifacts, not only the report.
2. Red-team when policy, unattended execution, user data, or security warrants it.
3. Check every criterion against actual evidence.
4. Send code to native `verifier` for `CONFIRMED`/`REFUTED` when R7 in `judgment.md` fires.
   External-worker code always fires R7 — worker pedigree never substitutes for the gate.

First failure retries the same worker with `.out` and `.meta.json` included. Second failure
escalates to native engineer or security-engineer with the full trail. There is no third
blind retry.

## Recovery

The checkpoint protocol is documented in `dispatch.md`. This section covers the runner's
role and trust considerations.

A null `baselineRef` means no checkpoint was taken (non-git directory or a repo before its
first commit). Skip the reset protocol when baselineRef is null.

On worker failure, timeout, `REFUTED` verification, or — when R7 skipped the verifier — a
criterion that fails sign-off at intake, the correct sequence is:

1. Reset and clean: `autopilot-worker reset --to <baselineRef> --workdir <root> --clean`.
   Cleaning before the stash pop is safe because stashed files live inside the stash object.
2. Pop the autopilot stash by message label (not `git stash pop` which pops the newest —
   a git-aware worker may have pushed its own stash entries during its run).
3. Retry or escalate into the now-clean tree.

For native Agent-tool dispatches (no runner, no meta.json), the orchestrator must capture
`git rev-parse HEAD` itself before dispatching and record it in the ledger. On failure, the
orchestrator runs `autopilot-worker reset` with that recorded ref. If the runner is absent
(degraded mode), fall through to manual `git reset --hard` + `git clean -fd` via Bash and
log the degradation.

The `changedFiles` manifest is useful for sequential dispatch forensics — identifying which
dispatch touched which files after the fact. Do not use it for parallel overlap detection:
in a shared working directory, concurrent runners see each other's changes and produce
misleading manifests. True parallel isolation requires worktree support.

The `baselineRef` in meta.json is written by the runner into a worker-writable directory.
For high-trust recovery, cross-check it against the ref the orchestrator recorded in the
ledger before dispatching. A poisoned meta.json could target an attacker-chosen ref.

## Hand-assembly fallback

If the installed runner is absent, the orchestrator may resolve a CLI record manually:
substitute each argument as a distinct argv element, use no shell interpolation, enforce
the record timeout, capture stdout/stderr, and write the same output/metadata shape. If
that cannot be done safely, use the native role and log the degradation.
