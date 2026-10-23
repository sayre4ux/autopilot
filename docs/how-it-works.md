# How it works

The orchestrator runs a ten-step loop; see the [command loop diagram](diagrams/command-loop.html). This page covers roles, entry, wake channels, state, and degradation.

## Roles

Native roles cover architecture, code at two effort tiers, visual documents, security,
verification, review, and project-level supervision. The orchestrator is the only
dispatcher; agents never spawn agents.

| Role | Model / effort | Job |
|---|---|---|
| architect | opus / high | Design, trade-offs, arbitration; no production code |
| engineer | opus / medium | Normal code, scripts, data |
| engineer-lite | haiku / medium | Fully specified, self-contained code with an acceptance command |
| senior-engineer | opus / high | Code where a defect is expensive: interfaces, concurrency, migrations, data integrity |
| engineer-doc | opus / medium | Documents and visuals, rendered and inspected |
| security-engineer | opus / high | Auth, secrets, crypto, validation, hardening |
| verifier | opus / high | `CONFIRMED` or `REFUTED`; never fixes |
| reviewer | opus / high | Adversarial findings by severity; never fixes |
| supervisor | fable / high | `ON-TRACK`, `DRIFT`, or `STOP` for the whole job, at plan, milestone, escalation, and final gates |

Efforts are tuned for Claude Opus 5.5, where `medium` does roughly what Opus 5 did at `high`.
The orchestrator itself runs on `opus`: Fable costs 2.5x per token and its safety classifiers
can decline defensive security work partway through, so it supervises rather than drives.

## Entry and delegation

Work above the software threshold—more than three files, more than 200 changed lines, or
multi-component design—may auto-enter. Document, deck, visual, and prose work enters only
when explicitly orchestrated.

Auto-entry starts the loop; it does not by itself guarantee that agents spawn. Both primary
vehicles can restrict delegation to what the user asked for, and both outrank any plugin or
`CLAUDE.md` policy. Claude Code may inject a system-prompt line confining Agent-tool calls to
requested delegation; whether it is present varies by build. `sc instructions orchestration` states that
subagent, delegation, and parallel-work language never authorizes `sc agent`, `sc agents`,
`sc team`, or `sc layout`, and that delegation must not be inferred from task size. On an
auto-entered job the user asked for the work and never asked for agents, so only registry
CLI workers invoked through Bash remain available. If such a job completes inline, that is
the mechanism; typing `/autopilot:orchestrate` satisfies both conditions and clears it.

## Wake

Dispatched work wakes the session when it finishes, so the orchestrator ends its turn instead of
idling. There are two wake channels:

- **sc callback.** With a resolved sc address, the runner emits the callback for CLI workers
  (Codex, Grok, opencode, omp) on every exit path, and sc-managed agents carry the send command
  in their brief. It survives the orchestrator's process exiting, which is what makes fan-out
  usable from a headless `claude -p` session.
- **Claude Code task notification.** Without sc, the runner is launched as a background Bash
  task and Agent-tool subagents run in the background; Claude Code wakes the session when each
  finishes. This needs a persistent interactive session.

A headless session with neither keeps every dispatch in-turn. Long workers must go out of turn
either way: a foreground Bash call is killed at 10 minutes, and max-effort coders routinely run
for an hour.

## State

Runtime state belongs to the user and project, not the plugin:

| Location | Purpose |
|---|---|
| `~/.autopilot/config.jsonc` | Global role, review, and worker preferences |
| `~/.autopilot/workers/*.json` | Global worker registry |
| `<project>/.autopilot/` | Project overlay, worker overrides, ledger, briefs, artifacts, lessons |

Project records and overlay values override matching global values.

Separately from that gitignored state, a project may keep a committed root `DEVLOG.md` as
its handover surface for any agent harness — a one-screen State header rewritten at each
close-out plus append-only numbered entries with verification evidence. Autopilot
maintains an existing devlog (single writer: the orchestrator) but never creates one
uninvited; reference it from `CLAUDE.md` and `AGENTS.md` so Claude, Codex, and other tools
all find it on a cold pickup.

## Degradation

Autopilot has no required external worker or reviewer:

| Failure | Behavior |
|---|---|
| Worker registry empty | Dispatch the matching native role |
| Runner or worker command unavailable | Log the failure and use the native role |
| External worker fails twice | Escalate with its full evidence trail |
| Independent review worker unavailable | Fill the panel with the native reviewer; solo review when only one seat fills |
| Only one model tier available | Keep role separation, strengthen briefs, reduce parallelism |
| Claude Code without mods | Skills, agents, workers, and the Python command hooks still run; the Fable gate, nested-spawn backstop, and `/ledger` are absent (builds older than 2.1.284 are untested) |

Aliases (`opus`, `sonnet`, `haiku`, `fable`) keep role bindings independent of dated model releases.
The system remains functional with review off.
