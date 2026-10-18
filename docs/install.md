# Install

## Requirements

Requires a current Claude Code release with plugin user configuration, agent
`model`/`effort` frontmatter, the `opus` and `fable` aliases, and `fallbackModel` support.
The function-hooks mod (`hooks/register.tsx`) additionally needs a mods-capable Claude Code:
it was written and tested on 2.1.287, where mods are on by default, and validated on 2.1.284
and 2.1.286. Skills, agents, workers, and the Python command hooks work on older builds.

## Install the plugin

From Claude Code, add this repository as a marketplace and install the plugin:

```text
/plugin marketplace add sayre4ux/autopilot
/plugin install autopilot@autopilot-marketplace
```

Then run:

```text
/autopilot:setup
```

## What setup does

Setup is explicit-only. It first inspects the current configuration, then presents one plan
and waits for approval before writing. It can:

- Merge `model: "opus"` and a fallback alias list into user settings without replacing
  unrelated keys. It advises against `best`, which resolves to Fable 5.1 on current builds.
- Extend an existing `availableModels` allowlist; it never creates an allowlist.
- Install a user-level haiku Explore override. User level is required because a plugin
  agent cannot shadow the built-in Explore agent.
- Create the runtime skeleton and install the worker runner.

Existing settings are backed up once. Existing Explore and overlay files are diffed, never
blindly replaced. Restart Claude Code after setup so agent and model changes load.

## Going back to 0.2.0

0.2.0 is the last release without the mod. Both versions use the marketplace name
`autopilot-marketplace`, so remove the current one first, then install from a clone of the
`v0.2.0` tag:

```bash
claude plugin uninstall autopilot@autopilot-marketplace
claude plugin marketplace remove autopilot-marketplace
git clone --branch v0.2.0 https://github.com/sayre4ux/autopilot autopilot-0.2.0
claude plugin marketplace add ./autopilot-0.2.0
claude plugin install autopilot@autopilot-marketplace
```

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
