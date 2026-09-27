# Roles and execution tiers

## Orchestrator

The current session is the only dispatcher. It plans, decomposes, selects workers,
validates, synthesizes, and owns the ledger. It does not delegate ritualistically or ask
agents to spawn agents. Doctrine must remain executable by the weakest available tier.

## Native roles

| Role | Agent tool dispatch | Alias | Effort | Duty |
|---|---|---|---:|---|
| architect | `subagent_type: "autopilot:architect"` | opus | high | Design, research, trade-offs, arbitration; never production code |
| engineer | `subagent_type: "autopilot:engineer"` | opus | medium | Normal code, scripts, and data implementation |
| senior-engineer | `subagent_type: "autopilot:senior-engineer"` | opus | high | Design-bearing or correctness-critical code: interfaces, concurrency, migrations, data integrity, cross-seam refactors |
| engineer-doc | `subagent_type: "autopilot:engineer-doc"` | opus | medium | Document/visual implementation with render-and-inspect evidence |
| security-engineer | `subagent_type: "autopilot:security-engineer"` | opus | high | Auth, secrets, crypto, validation, hardening, vulnerability work |
| verifier | `subagent_type: "autopilot:verifier"` | opus | high | Fresh-context `CONFIRMED`/`REFUTED` code gate; never fixes |
| reviewer | `subagent_type: "autopilot:reviewer"` | opus | high | Fresh-context adversarial severity-tagged findings; never fixes |
| supervisor | `subagent_type: "autopilot:supervisor"` | fable | high | Project-level `ON-TRACK`/`DRIFT`/`STOP` at orchestration gates; never edits or dispatches |

Dispatch native roles with the Agent tool using the exact namespaced `subagent_type` above,
unless the step-0 probe found sc — then the sc path below is the vehicle, not this one.
Agent frontmatter supplies each role's model and effort. The Agent tool takes a per-call
`model` parameter — pass the overlay-resolved model there — but has no per-call effort
argument: a subagent runs at its frontmatter `effort`, which overrides the session effort
while active (omitted inherits the session). Per-dispatch effort variance comes only from the
sc path's `--reasoning` or a distinct definition, never an Agent-tool argument — which is why
`engineer` and `senior-engineer` are two definitions rather than one role at two efforts.
Aliases are `opus`, `fable`, `sonnet`, or `haiku`, never dated identifiers. On Claude Code
2.1.283 `opus` resolves to Claude Opus 5.5 and `fable` to Claude Fable 5.1.

When sc-managed orchestration is detected, dispatch these roles as labeled sc agents per
`dispatch.md` instead of Agent-tool subagents. The brief's `<system>` block replaces agent
frontmatter entirely and is passed as `--system-prompt`, not folded into the prompt. The
resolved effort maps to `--reasoning`; `sc layout capabilities --output json` lists provider
keys only and carries no model ids, so `--model` is omitted and the provider default applies
unless the user named an id. Role boundaries, effort policy, and the
no-agent-spawning rule apply unchanged. The Agent tool is the degraded floor for when sc is
absent or fails — not the default to fall back on because the probe was skipped.

### Effort policy

Effort is tuned to the model generation. Opus 5.5 at `medium` does roughly what Opus 5 did
at `high`, and its API default is `medium`. So:

- `medium` for one-shot delegated work where a routine defect is cheap to catch at intake:
  `engineer`, `engineer-doc`.
- `high` where a missed failure is expensive or propagates: `architect`, `senior-engineer`,
  and the adversarial roles `security-engineer`, `verifier`, and `reviewer`.
- `xhigh` and `max` only where a measured eval shows the gain pays for itself. No shipped
  role uses them.

Route by what a defect would cost, not by task size: a small change to a public interface
goes to `senior-engineer`; a large mechanical change goes to `engineer`.

Because the Agent tool carries no per-call effort, these values land through the definition's
frontmatter or the sc path's `--reasoning`. An overlay that changes effort therefore takes
effect only on the sc path or via a distinct definition.

Legacy: the Opus 5 policy ran every delegated role at `high` or above and reserved `xhigh` for
the adversarial roles; before that, effort branched on whether `opus` resolved to 4.8 or 4.6.
Both are retired. Re-tune effort when the `opus` alias moves to a new generation, and back any
raise above `high` with an eval.

### Fable

`fable` (Claude Fable 5.1) is the most capable tier and costs 2.5x Opus 5.5 per token, with
long turns. It runs one shipped role, `supervisor`, which is called at gates rather than per
task. Two constraints follow from its safety classifiers, which can decline ordinary
defensive security work partway through a turn:

- Never orchestrate security-sensitive work from a Fable main session. If the orchestrator
  itself resolves to Fable and the job includes `security-engineer` work, tell the user and
  recommend restarting the job on `opus`; do not dispatch security work from that session.
- Give `supervisor` summaries of security tasks, not exploit or payload detail. If it declines
  anyway, re-run the same gate on `opus` at `high` through the Agent tool's `model` override,
  log `supervisor: fable declined -> opus`, and treat the result as the gate's verdict.

Opus 5.5 also runs `cyber`, `bio`, and `reasoning_extraction` classifiers. A
`security-engineer` dispatch that stops on a refusal is a failed dispatch, not a retry
candidate: route the brief to a registry worker from another family with `code` or `review`
capability, or ask the user.

## External workers

Registry records add CLI, MCP, or native-subagent routes without changing the plugin.
Capability tags (`code`, `refactor`, `test`, `review`, `docs`, `data`, `security`,
`research`, `design`) decide eligibility. `preferWhen`, `avoidWhen`, overlay ordering, and
`modelFamily` break ties. Prefer an independent family for review.

External workers are executors, not dispatchers. They receive the same brief and pass the
same intake gates. Native agents are the guaranteed floor when the registry is absent,
disabled, invalid, unavailable, or fails twice.

## Role boundaries

- Architecture and implementation are separate tasks when both are needed.
- Security-sensitive work routes to `security-engineer`, not general engineering.
- Code where a defect is expensive routes to `senior-engineer`; the rest goes to `engineer`.
- Visual work reaches `engineer-doc` only through explicit orchestration.
- Verifiers produce one evidence-backed verdict and never repair.
- Reviewers produce findings and never become the author.
- The supervisor judges the job, not a deliverable. It never edits, dispatches, or overrides
  a gate; the orchestrator acts on its verdict and a `STOP` goes to the user.

## Degradation

If only one model tier is available, override every native dispatch to that alias and log
`(degraded)` in the ledger. Preserve role separation, write more explicit criteria, add
reasoning instructions to architecture briefs, and reduce parallelism. If workers or the
runner are unavailable, fall through to the corresponding native role and log why. If
`fable` is unavailable, run `supervisor` on `opus` through the Agent tool's `model` override
and log it; the gate still runs.

Invalid or unavailable aliases must fail visibly. Try the next available alias and record
the resolution; never silently invent a model identifier.
