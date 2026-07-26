---
name: setup
description: Explicit, approval-gated Autopilot setup. Inspects and proposes user settings, the Explore override, runner, overlay, and runtime directories. Never invoke automatically.
disable-model-invocation: true
---

# Autopilot setup

Run only when the user explicitly invokes setup. Be idempotent, backup-first, and
approval-gated. Perform no write before showing one consolidated plan and receiving
approval.

Shipped sources are relative to this skill:

- Explore template: `../../templates/Explore.md`
- Overlay template: `../../templates/config.example.jsonc`
- Settings proposal: `../../templates/settings.snippet.json`
- Worker runner: `../../workers/autopilot-worker`
- Worker presets: `../../workers/presets/`

## 1. Read-only preflight

Inspect and report:

- Whether `claude` is available and whether `claude plugin validate` succeeds for the
  installed plugin.
- `~/.claude/settings.json` keys `model`, `fallbackModel`, and `availableModels`, preserving
  unknown keys.
- Existing `~/.claude/agents/Explore.md`.
- Existing `~/.autopilot/config.jsonc`, directories, runner, and worker records.
- `CLAUDE_CODE_SUBAGENT_MODEL`; warn that it overrides per-agent bindings.

### Prior orchestration harness detection

Check for a pre-existing orchestration setup that Autopilot replaces:

- `~/.claude/skills/orchestrate/` — a user-level orchestrate skill. If present, it will
  take precedence over the plugin's `autopilot:orchestrate` when the user invokes
  `/orchestrate`, meaning the old harness runs instead of Autopilot.
- `~/.claude/agents/{architect,engineer,engineer-doc,security-engineer,verifier,reviewer}.md`
  — user-level role agents. These shadow the plugin's namespaced agents. Dispatches using
  `subagent_type: "autopilot:architect"` still resolve correctly, but the old agents may
  contain dated model pins, absolute paths, or machine-specific tool grants.

If either is detected, present the finding and offer the user two options:

1. **Run alongside (if the user's agents have custom capabilities they want to keep):**
   Autopilot's plugin agents are namespaced (`autopilot:architect`, etc.) and will work
   even with user-level agents present. The user-level `/orchestrate` skill would need to
   be renamed or removed so Autopilot's skill takes over dispatching. Explain that keeping
   old agents means two sets of role definitions — the user is responsible for maintaining
   consistency.

2. **Clean migration (recommended for most users):**
   Back up and remove the old skill and agents. Autopilot replaces them with equivalent
   namespaced roles. Offer to:
   - Move `~/.claude/skills/orchestrate/` to `~/.claude/skills/orchestrate.backup/`
   - Move each detected agent file to `<name>.md.backup` in the same directory
   - List exactly which files will be moved, and only proceed with approval

Do not delete anything without explicit approval. Do not silently skip detection. If prior
harness files reference external directories (e.g., `~/Development/AI-harness/`), note that
those source files are untouched — only the Claude Code skill and agent files are moved.

Validate existing JSON before proposing edits. If required shipped sources cannot be read,
stop and name the missing path.

## 2. Propose one plan

Show exact targets and diffs:

| Target | Proposed behavior |
|---|---|
| `~/.claude/settings.json` `model` | Set missing value to `"best"`; if present and different, ask; if already `"best"`, skip |
| `fallbackModel` | If absent, add `["opus","sonnet"]`; if present, leave and note |
| `availableModels` | Only when the key already exists, ensure chosen main plus `opus`, `sonnet`, `haiku`; if absent leave unrestricted |
| `~/.claude/agents/Explore.md` | Install the haiku/low user-level override; show a diff before replacing different content |
| `~/.autopilot/` | Ensure `bin/`, `workers/`, `dispatch/`, `artifacts/`; install runner; seed config and empty lessons only when absent |

Explain that a user-level Explore file is required because plugin agents cannot shadow the
built-in agent.

Obtain explicit approval for the consolidated plan. An existing, different Explore file or
config file requires its own clear overwrite decision; never replace either blindly.

## 3. Apply safely

- Back up `settings.json` once, before the first Autopilot edit, preserving the pristine
  state. Do not overwrite that backup on re-run.
- Merge settings key-by-key; never replace the entire object. Validate JSON after editing.
- Copy the Explore template and overlay only as approved.
- Install the runner at `~/.autopilot/bin/autopilot-worker` with executable permissions.
- Create `workers/`, `dispatch/`, and `artifacts/`; create `lessons.md` empty only if absent.
- Ensure `.autopilot/` is listed in the target project's `.gitignore`. The checkpoint
  protocol's stash and clean operations destroy briefs, ledger state, and artifacts if the
  directory is untracked. If `.gitignore` does not exist, create it with `.autopilot/`. If
  it exists but lacks the entry, append it.
- Do not mark a worker trusted. Presets are examples; copy only those the user selects.

On re-run, skip identical files. For differing installed runner/template content, show a
diff and request upgrade approval.

## 4. Report

List changed, skipped, and backed-up paths. Re-run JSON validation and runner `--help`.
Tell the user to restart Claude Code because agents and the main model load at session
start; skills can hot-reload. Explain how to verify that `/agents` shows Explore at
haiku/low.

Never put model, fallback, or effort settings inside plugin metadata. All settings changes
are proposals to the user's own configuration after approval.
