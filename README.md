# Autopilot

> A full command loop for Claude Code: plan, dispatch, verify, reconcile.

Autopilot is an MIT-licensed Claude Code plugin for work that is too large for one context.
It packages a persistent task ledger, self-contained dispatch briefs, six native roles,
severity-gated review, and an optional registry of external coding workers.

Quality does not depend on which worker produced the change. Every result returns through
the same intake gates, and non-trivial code receives a fresh-context native verifier.

## Why

Large agentic jobs fail in predictable ways: the main context fills with mechanical work,
agents assume context they were never given, passing tests hide hardcoded fixtures, and
promised work disappears after interruption. Autopilot turns those failure modes into
explicit mechanics:

- Delegate only when isolation, parallelism, or scale offsets dispatch overhead.
- Give every worker a complete brief with acceptance criteria and redlines.
- Track non-trivial work before acting so restarts do not erase commitments.
- Separate authors from reviewers and verifiers.
- Require real evidence, including a successful run for mechanisms.
- Cap retries and change approach instead of repeating a failed invocation.

The doctrine is written for the weakest available orchestrator tier. Model bindings use
aliases, and external workers are optional.

## How it works

The `/autopilot:orchestrate` skill runs a ten-step loop:

```text
restate → check → review mode → route → ticket → decompose
        → dispatch → intake → zoom out → close out
```

Native roles cover architecture, code, visual documents, security, verification, and
review. The orchestrator is the only dispatcher; agents never spawn agents. Work above the
software threshold—more than three files, more than 200 changed lines, or multi-component
design—may auto-enter. Document, deck, visual, and prose work enters only when explicitly
orchestrated.

Runtime state belongs to the user and project, not the plugin:

| Location | Purpose |
|---|---|
| `~/.autopilot/config.jsonc` | Global role, review, and worker preferences |
| `~/.autopilot/workers/*.json` | Global worker registry |
| `<project>/.autopilot/` | Project overlay, worker overrides, ledger, briefs, artifacts, lessons |

Project records and overlay values override matching global values.

## Install

Requires a current Claude Code release with plugin user configuration, agent
`model`/`effort` frontmatter, `best`, and `fallbackModel` support.

From Claude Code, add this repository as a marketplace and install the plugin:

```text
/plugin marketplace add <github-owner>/autopilot
/plugin install autopilot@autopilot-marketplace
```

Then run:

```text
/autopilot:setup
```

Setup is explicit-only. It first inspects the current configuration, then presents one plan
and waits for approval before writing. It can:

- Merge `model: "best"` and a fallback alias list into user settings without replacing
  unrelated keys.
- Extend an existing `availableModels` allowlist; it never creates an allowlist.
- Install a user-level haiku/low Explore override. User level is required because a plugin
  agent cannot shadow the built-in Explore agent.
- Create the runtime skeleton and install the worker runner.

Existing settings are backed up once. Existing Explore and overlay files are diffed, never
blindly replaced. Restart Claude Code after setup so agent and model changes load.

For local development, validate from the repository root:

```bash
claude plugin validate .
```

## Workers

Workers are JSON records validated by
[`workers/registry.schema.json`](workers/registry.schema.json). Three types are supported:

| Type | Invocation |
|---|---|
| `cli` | `~/.autopilot/bin/autopilot-worker` |
| `subagent` | Claude Code Agent tool |
| `mcp` | The record's named MCP tool |

The shipped files in [`workers/presets/`](workers/presets/) are editable examples. Adding a
worker does not require changing the plugin.

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

## Enforcement hooks

Autopilot includes optional fail-open hooks. `advisory` is the default:

- The Bash guard recognizes a deliberately small set of catastrophic commands. Strict mode
  blocks only a positive match; advisory mode warns.
- The Stop hook reminds the session about its active/open ledger rows.
- Any hook parsing, runtime, or platform error allows the operation. A broken hook must not
  brick Bash or trap a session.

Set plugin user configuration `enforcement` to `off`, `advisory`, or `strict`. The plugin
can also be disabled entirely from `/plugin`.

## Degradation

Autopilot has no required external worker or reviewer:

| Failure | Behavior |
|---|---|
| Worker registry empty | Dispatch the matching native role |
| Runner or worker command unavailable | Log the failure and use the native role |
| External worker fails twice | Escalate with its full evidence trail |
| Independent review worker unavailable | Use native reviewer or proceed when review is off |
| Only one model tier available | Keep role separation, strengthen briefs, reduce parallelism |

Aliases (`opus`, `sonnet`, `haiku`) keep role bindings independent of dated model releases.
The system remains functional with review off.

## Uninstall

1. Disable and uninstall `autopilot` with `/plugin`.
2. Remove `~/.autopilot/` if its registries, artifacts, and lessons are no longer needed.
3. Remove `~/.claude/agents/Explore.md` only if setup installed it and you no longer want
   the override.
4. Restore the setup-created pristine settings backup, or remove only the keys you approved
   during setup. Preserve unrelated settings.
5. Restart Claude Code.

Project `.autopilot/` directories contain job history and artifacts; inspect them before
deleting.

## Contributing

See [`docs/design.md`](docs/design.md) for architecture, trust boundaries, and invariants.
Keep user-specific configuration outside the plugin, preserve native degradation, and add
real-run evidence for mechanism changes.

## License

[MIT](LICENSE)
