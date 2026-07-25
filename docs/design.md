# Autopilot architecture

## Purpose

Autopilot packages a complete orchestration process as one Claude Code plugin. It provides
an auto-invokable orchestration skill, explicit-only setup skill, six native roles, optional
enforcement hooks, and a registry-driven worker layer. User and project configuration stays
outside the installed plugin.

The central invariant is producer-independent quality: native agents, CLI tools, and MCP
workers receive equivalent briefs and re-enter the same intake gates.

## Boundaries

- The current session is the only dispatcher. Agents and workers cannot recursively
  delegate.
- Plugin metadata does not set the main model, fallback model, or main-session effort.
  Setup proposes user-setting changes after approval.
- The plugin does not ship an Explore agent because plugin agents cannot shadow the built-in
  role. Setup offers a user-level override from `templates/Explore.md`.
- Skill and agent bodies use relative doctrine paths. Plugin-root expansion is reserved for
  hook commands where the host supports it.
- Runtime state lives in `~/.autopilot/` and `<project>/.autopilot/`.

## Components

### Skills

`orchestrate` implements a ten-step loop: restate, check, choose review mode, route, ticket,
decompose, dispatch, intake, zoom out, and close. Supporting references hold the canonical
roles, dispatch templates, judgment rubrics, review loop, diagnosis, maintenance, and
worker doctrine.

`setup` is disabled from model invocation. It inspects first, presents one merge plan, waits
for approval, backs up user settings once, and applies only approved key/file changes.

### Native roles

| Agent | Alias / effort | Boundary |
|---|---|---|
| architect | opus / high | Designs and arbitrates; no production code |
| engineer | opus / high | Code, scripts, data |
| engineer-doc | opus / high | Visual/doc work with render inspection |
| security-engineer | opus / xhigh | Security-sensitive work |
| verifier | opus / xhigh | Refutes or confirms; never fixes |
| reviewer | opus / high | Severity findings; never fixes |

Global and project overlays can override these values per Agent call. Model identifiers
remain aliases.

### Worker registry

Each record under global or project `workers/` follows Draft 2020-12 JSON Schema. Project
ids replace global ids. Common fields describe capabilities, model family, selection
guidance, enabled state, and trust. Exactly one variant is present:

- `subagent`: Agent type and optional alias/effort overrides.
- `cli`: executable, argv template, prompt delivery, environment, timeout, accepted exits.
- `mcp`: scoped tool, argument template, result field, timeout.

Capability matching establishes eligibility. Preference/avoidance notes, overlay order, and
model-family independence break ties. No match means native fallback.

### CLI runner

The installed runner accepts a worker id, absolute brief path, project root, optional output
directory and timeout, plus an approval bypass for already approved runs. It:

1. Loads global then project registry records.
2. Validates the selected record and executable.
3. Resolves six known template variables without shell evaluation.
4. Displays untrusted commands for approval.
5. Enforces timeout and captures output.
6. Writes deterministic output and metadata.

Runner exits are `0` success, `2` worker/output failure, `3` registry/record/command error,
`4` declined approval, and `124` timeout. The runner executes only CLI records; the
orchestrator owns subagent and MCP invocation.

### Completion callback

A dispatched worker must be able to wake the session that dispatched it. The orchestrator
resolves its own sc target once per job and passes it down; whoever owns the worker's process
emits the ping when that process ends. For CLI workers that is the runner, which sends on
every exit path and records `callback: { target, idempotencyKey, delivered, error }` in
metadata; `--detach` re-execs the runner in its own session so the dispatching turn can end
while the worker runs. For sc-managed role agents there is no wrapper, so the brief carries
the send command as a mandatory final action with `sc agent wait` as fallback. Agent-tool and
MCP dispatch need nothing — the tool return is the ping.

The design point is that the guarantee lives in the wrapper, not in the worker's goodwill:
Claude, Codex, and Grok are all covered identically because none of them is trusted to
remember. It exists because the driving session is often headless (`claude -p`), where the
process exits at turn end and a queued callback is the only thing that restarts it. Without a
resolved callback address the harness stays fully synchronous, which is the older behavior and
always correct.

### Intake

Every producer passes:

1. Artifact spot-check for gaming and unsupported limitations.
2. Conditional fresh-context red-team.
3. Criterion-by-criterion sign-off using real evidence.
4. Native verification when R7 fires — always for external-worker code.

Review is independently optional. It selects a review-capable worker from another model
family when possible, otherwise the native reviewer. Only critical/major findings trigger a
new round. Round three escalates to architect arbitration.

### Hooks

The Bash guard is fail-closed only for a positive catastrophic-pattern match in strict mode.
Advisory mode emits the same warning without blocking. The ledger nudge is advisory. Both
catch all internal errors and return success so a parsing or platform defect cannot break
normal host behavior.

## Trust model

Registry files authorize executable commands with the user's privileges. Records default
to untrusted and require review of the fully resolved argv. Briefs are delivered through
stdin or file where possible and placeholders become argv elements rather than shell text.
Setup never makes trust decisions for the user.

External output is untrusted evidence, not an accepted result. Its model family, brand, or
capability claim grants no quality shortcut.

## Failure and degradation

The native roles are the availability floor. Missing registries, commands, servers, runner,
or reviewers cause a logged fallback rather than a broken command loop. First worker
failure feeds evidence into one retry; second failure escalates to native execution. A
third attempt must change approach, worker, or tier.

If all native roles resolve to one tier, role and context separation still apply. The
orchestrator compensates with more explicit criteria and lower concurrency.

## Runtime data

Project `.autopilot/` contains:

```text
ledger.md
dispatch/
artifacts/
archive/
workers/
config.jsonc
lessons.md
```

Artifacts are never automatically deleted. Completed ledger rows may be archived after the
documented threshold; their regenerable briefs may then be removed.

## Contributor invariants

1. Keep plugin content free of user and machine specifics except the single labeled
   illustrative environment comment in the overlay example.
2. Preserve relative references in skills and agents.
3. Preserve alias-only role frontmatter.
4. Add registry capabilities through data, not runner branches.
5. Maintain fail-open behavior for every hook error.
6. Demonstrate runner, timeout, schema, and hook behavior with real commands.
7. Never let optional review or an external worker become load-bearing.
