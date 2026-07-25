# Roles and execution tiers

## Orchestrator

The current session is the only dispatcher. It plans, decomposes, selects workers,
validates, synthesizes, and owns the ledger. It does not delegate ritualistically or ask
agents to spawn agents. Doctrine must remain executable by the weakest available tier.

## Native roles

| Role | Agent tool dispatch | Alias | Effort | Duty |
|---|---|---|---:|---|
| architect | `subagent_type: "autopilot:architect"` | opus | high | Design, research, trade-offs, arbitration; never production code |
| engineer | `subagent_type: "autopilot:engineer"` | opus | high | Code, scripts, and data implementation |
| engineer-doc | `subagent_type: "autopilot:engineer-doc"` | opus | high | Document/visual implementation with render-and-inspect evidence |
| security-engineer | `subagent_type: "autopilot:security-engineer"` | opus | xhigh | Auth, secrets, crypto, validation, hardening, vulnerability work |
| verifier | `subagent_type: "autopilot:verifier"` | opus | xhigh | Fresh-context `CONFIRMED`/`REFUTED` code gate; never fixes |
| reviewer | `subagent_type: "autopilot:reviewer"` | opus | high | Fresh-context severity-tagged findings; never fixes |

Dispatch native roles with the Agent tool using the exact namespaced `subagent_type` above.
Agent frontmatter supplies each role's model and effort. The Agent tool takes a per-call
`model` parameter — pass the overlay-resolved model there — but has no per-call effort
argument: a subagent runs at its frontmatter `effort`, which overrides the session effort
while active (omitted inherits the session). Per-dispatch effort variance comes only from the
sc path's `--reasoning` or a distinct definition, never an Agent-tool argument. Aliases remain
`opus`, `sonnet`, or `haiku`, never dated identifiers.

When sc-managed orchestration is detected, dispatch these roles as labeled sc agents per
`dispatch.md` instead of Agent-tool subagents. The brief's `<system>` block replaces agent
frontmatter entirely; the resolved alias/effort maps to `--model`/`--reasoning` using ids
listed by `sc layout capabilities --output json`. Role boundaries, effort policy, and the
no-agent-spawning rule apply unchanged; the Agent tool remains the guaranteed floor.

Effort does not vary by model generation. Every delegated role runs at `high` or above: a
subagent gets one shot with no interactive correction, so the floor is `high` even when the
orchestrator session itself runs at `medium`. `xhigh` is reserved for the two adversarial
roles — `security-engineer` and `verifier` — where a missed failure is expensive. `max`
exists where a model supports it; this policy does not use it. Never dispatch below `high`.

Because the Agent tool carries no per-call effort, these values land through the definition's
frontmatter or the sc path's `--reasoning`. An overlay that raises effort therefore takes
effect only on the sc path or via a distinct definition.

Legacy: earlier revisions branched effort on whether `opus` resolved to 4.8 or 4.6 (lift to
`xhigh` on 4.8, clamp to `high` on 4.6). That policy is retired — the `opus` alias resolves
to Opus 5, which exposes the full effort range. Do not reintroduce generation-conditional
effort without an eval showing it pays.

## External workers

Registry records add CLI, MCP, or native-subagent routes without changing the plugin.
Capability tags (`code`, `refactor`, `test`, `review`, `docs`, `data`, `security`,
`research`) decide eligibility. `preferWhen`, `avoidWhen`, overlay ordering, and
`modelFamily` break ties. Prefer an independent family for review.

External workers are executors, not dispatchers. They receive the same brief and pass the
same intake gates. Native agents are the guaranteed floor when the registry is absent,
disabled, invalid, unavailable, or fails twice.

## Role boundaries

- Architecture and implementation are separate tasks when both are needed.
- Security-sensitive work routes to `security-engineer`, not general engineering.
- Visual work reaches `engineer-doc` only through explicit orchestration.
- Verifiers produce one evidence-backed verdict and never repair.
- Reviewers produce findings and never become the author.

## Degradation

If only one model tier is available, override every native dispatch to that alias and log
`(degraded)` in the ledger. Preserve role separation, write more explicit criteria, add
reasoning instructions to architecture briefs, and reduce parallelism. If workers or the
runner are unavailable, fall through to the corresponding native role and log why.

Invalid or unavailable aliases must fail visibly. Try the next available alias and record
the resolution; never silently invent a model identifier.
