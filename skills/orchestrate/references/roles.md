# Roles and execution tiers

## Orchestrator

The current session is the only dispatcher. It plans, decomposes, selects workers,
validates, synthesizes, and owns the ledger. It does not delegate ritualistically or ask
agents to spawn agents. Doctrine must remain executable by the weakest available tier.

## Native roles

| Role | Agent tool dispatch | Alias | Effort | Duty |
|---|---|---|---:|---|
| architect | `subagent_type: "autopilot:architect"` | opus | high | Design, research, trade-offs, arbitration; never production code |
| engineer | `subagent_type: "autopilot:engineer"` | sonnet | high | Code, scripts, and data implementation |
| engineer-doc | `subagent_type: "autopilot:engineer-doc"` | opus | high | Document/visual implementation with render-and-inspect evidence |
| security-engineer | `subagent_type: "autopilot:security-engineer"` | opus | xhigh | Auth, secrets, crypto, validation, hardening, vulnerability work |
| verifier | `subagent_type: "autopilot:verifier"` | opus | xhigh | Fresh-context `CONFIRMED`/`REFUTED` code gate; never fixes |
| reviewer | `subagent_type: "autopilot:reviewer"` | opus | high | Fresh-context severity-tagged findings; never fixes |

Dispatch native roles with the Agent tool using the exact namespaced `subagent_type` above.
Agent frontmatter supplies defaults. Global then project overlays resolve per-dispatch
model/effort overrides; pass the resolved model through the Agent tool's `model` parameter
and apply host-supported per-call effort overrides. Aliases remain `opus`, `sonnet`, or
`haiku`, never dated identifiers.

When sc-managed orchestration is detected, dispatch these roles as labeled sc agents per
`dispatch.md` instead of Agent-tool subagents. The brief's `<system>` block replaces agent
frontmatter entirely; the resolved alias/effort maps to `--model`/`--reasoning` using ids
listed by `sc layout capabilities --output json`. Role boundaries, effort policy, and the
no-agent-spawning rule apply unchanged; the Agent tool remains the guaranteed floor.

Effort follows the resolved `[1m]` model. Opus on 4.8 dispatches at `xhigh`; opus on 4.6
dispatches at `high` (4.6 exposes no `xhigh`). Never dispatch `sonnet` or `opus` below
`high`. When a frontmatter or overlay default is `xhigh` but the dispatch resolves opus to
4.6, clamp to `high`. Architect design and system-design dispatches resolve to 4.8
(`xhigh`); its research and arbitration dispatches resolve to 4.6 (`high`).

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
