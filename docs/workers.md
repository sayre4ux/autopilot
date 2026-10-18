# Workers

Workers are JSON records validated by
[`workers/registry.schema.json`](https://github.com/sayre4ux/autopilot/blob/main/workers/registry.schema.json). Three types are supported:

| Type | Invocation |
|---|---|
| `cli` | `~/.autopilot/bin/autopilot-worker` |
| `subagent` | Claude Code Agent tool |
| `mcp` | The record's named MCP tool |

The shipped files in [`workers/presets/`](https://github.com/sayre4ux/autopilot/tree/main/workers/presets) are editable examples. Adding a
worker does not require changing the plugin.

| Preset | Model / effort | Use | Timeout |
|---|---|---|---|
| `gpt-6-astra-design-cli` | GPT-6 Astra / medium, read-only | Design phase: a second design opinion from another family | 3600s |
| `gpt-6-1-sol-cli` | GPT-6.1 Sol / medium | Bulk code or review from a fully specified brief, or a second implementation from another family | 3600s |
| `gpt-6-luna-max-cli` | GPT-6 Luna / max | Cheap coding with long turns from a fully specified brief | 7200s |
| `grok-4.7-review-cli` | Grok 4.7 / high, read-only | Third-family review | 3600s |
| `grok-4.7-fix-cli` | Grok 4.7 / high | Fixing verified findings | 3600s |
| `opencode-cli` | opencode default | Cheap bulk execution | 1800s |
| `omp-cli` | omp's configured model | Cheap bulk execution | 1800s |
| `example-mcp-worker` | MCP tool | Template for an `mcp` worker record | 600s |

Timeouts come from observed run lengths: Luna at max effort has finished runs near an hour,
and Grok 4.7 review runs reach about half an hour. The runner accepts up to 14400s.

A CLI dispatch uses:

```bash
~/.autopilot/bin/autopilot-worker run <worker-id> \
  --brief <absolute-brief-path> \
  --workdir <project-root>
```

The runner substitutes known placeholders as separate arguments, never through a shell. It
enforces timeouts and writes `<task-id>.out` plus `<task-id>.meta.json`. Untrusted records
show the resolved command and require approval; setup never marks one trusted.

External work receives the identical brief and gates as native work. One failed external
run may retry with its failure trail. The second failure escalates to the native engineer,
or security engineer for security work.

## Codex compatibility

Codex works as an external `cli` worker (the `gpt-6-*` presets): the brief is delivered over
stdin to `codex exec`, the record pins the model, reasoning effort, and sandbox (`read-only`
for design, `workspace-write` for coding), and the runner enforces the timeout and emits the
completion callback on every exit path. Codex records stay `trusted: false`, so the resolved
command requires approval, and they are marked avoid-when for security-sensitive and visual
work.

One wrapper caveat applies to the provider binaries, not to the
[sc integration](super-engineering.md): in super.engineering-managed sessions the
binary on PATH resolves to an agent wrapper that changes the invocation. For `codex` the
wrapper spawns a session watcher and never exits, so `codex exec` hangs until killed. For
`omp` it prepends `-e <hook>.ts` to the argv, which the top-level flags tolerate but
subcommands such as `omp plugin` reject outright. Every shipped preset built on a wrapped
binary therefore sets `SUPERCONDUCTOR_MANAGED_AGENT=0` to force the wrapper's clean
passthrough branch — keep that override when editing them. Verified against wrapper v3
(codex 2026-07-26, omp 2026-07-30): both branches engage whenever a managed session exports
the variable as `1`. The override governs the wrapper's normal path only; the separate
command-override branch (`SUPERCONDUCTOR_COMMAND_OVERRIDE_DISPATCH=1`) is evaluated first and
ignores the variable, so invoking the real binary by absolute path remains the stronger
guarantee.

## omp compatibility

omp (oh-my-pi) works as an external `cli` worker
([`omp-cli.json`](https://github.com/sayre4ux/autopilot/blob/main/workers/presets/omp-cli.json)): the brief is delivered as an `@file`
message to `omp -p`, `--no-session` keeps worker runs out of the session store, and results
are collected from the worktree. The record pins no model, so the run uses whatever omp
resolves from its own configuration (`modelRoles.default` in `~/.omp/agent/config.yml`). That
is the point of the record — and the reason its `modelFamily` is `omp-configured` rather than
a real family name: the adversarial panel cannot treat it as a guaranteed independent family,
because the family is whatever the local config says today. When omp is the *producer*,
resolve that value before seating a reviewer, or the panel will count an opaque family as
independent when it is not.

Know the approval boundary before enabling it. Like every shipped record it is
`trusted: false`, so the runner prints the resolved command and waits for approval — but
`--auto-approve` is required for an unattended run, and it means that once the command is
approved, omp self-approves **every** subsequent tool call it makes inside `--workdir`: edits,
writes, shell commands, network access. That single command approval is the last human gate
in the run, which is why the record is marked avoid-when for security-sensitive work. Drop
`--auto-approve` if you intend to supervise a run interactively instead.
