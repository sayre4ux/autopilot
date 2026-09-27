# Dispatch protocol

## Canonical dispatch block

Every native or external worker receives this self-contained shape:

```xml
<dispatch>
  <to>architect | engineer | senior-engineer | engineer-doc | security-engineer | supervisor | external worker id</to>
  <task_id>T-001</task_id>
  <depends_on>none | T-###</depends_on>
  <domain>code | document | analysis | design | research</domain>
  <system>Role identity and boundaries; sufficient if replayed elsewhere.</system>
  <context>Background, decisions, and upstream artifact paths.</context>
  <objective>One sentence describing the required artifact or outcome.</objective>
  <acceptance_criteria>
    - Concrete criterion with a verification method
  </acceptance_criteria>
  <output_format>Exact response and artifact shape.</output_format>
  <redlines>Files, actions, or decisions that must not change.</redlines>
  <materials>All specifications, fixtures, and upstream outputs by readable path.</materials>
  <callback>Present only when the vehicle needs the agent to ping back; see the callback
  section. Omitted for Agent-tool dispatch, where Claude Code's task notification is the wake,
  and for MCP dispatch, which returns inline.</callback>
</dispatch>
```

Write briefs longer than about 20 lines to `.autopilot/dispatch/T-###.md`. Prefer files to
large inline content. Agents have no shared memory; a missing material is a gap, not
permission to synthesize a substitute. When the project keeps a root `DEVLOG.md` and its
State section bears on the task, cite it in `<materials>`; workers read the devlog but
never write it — the orchestrator appends the job's entry at close-out.

## Review block

```xml
<review>
  <task_id>T-001</task_id>
  <domain>code | document | analysis | design | research</domain>
  <panel>reviewer N of M | solo</panel>
  <deliverable>Full artifact or exact paths/diff.</deliverable>
  <spec>Authoritative design or specification.</spec>
  <criteria>Original acceptance criteria.</criteria>
  <instruction>
    Assume the deliverable is defective and hunt from every applicable angle; a PASS must
    be earned with evidence. On a panel, another reviewer examines the same artifact
    independently: confirmed defects you miss and findings that dissolve under check are
    both recorded against your review.
    Return structured critical | major | minor | nit findings with file/line evidence.
    No conversation and no edits.
  </instruction>
</review>
```

## Report contract

Return conclusions and artifact paths rather than large dumps. Include:

- What was done in at most five lines.
- Verification commands and key output.
- Limitations with evidence explaining why they remain.
- `IMPLEMENTATION NOTES` for implementers or `ASSUMPTIONS` for architects.

Source every factual or numeric claim.

## Completion callback and wake

The orchestrator never idles while workers run. Every dispatch vehicle *in the table below*
either returns its result inline or pings back and wakes the dispatching session when it
finishes. There are two wake channels, and which one a job has decides how long work may run
out of turn:

- **sc callback** — a queued `sc agent send` to the orchestrator's own sc target. It survives
  the orchestrator's process exiting between turns, so it is the only wake for a headless
  session (`claude -p` under super.engineering), where the turn ends, the process exits, and a
  queued message is the only thing that starts it again.
- **Harness task notification** — Claude Code itself wakes the session when a background task
  it started finishes: a Bash command run with `run_in_background`, or a background Agent-tool
  subagent. It needs the orchestrator's process to still exist, so it holds for a persistent
  interactive session and not for a headless one.

A vehicle's own delivery flag is not a wake. `delivered: true`, `fan_in_notified: true`, or a
successful send confirms that the notification left the sender — not that a session which has
already ended its turn will resume. Only the mechanisms listed below have verified restart
behavior in this environment. Any other vehicle counts as having no wake signal: run it
synchronously, or block on it before ending the turn, or record the poll command in the
ledger row and check it on the next turn. Never end a turn asserting a wake you have not
verified.

### Resolve the callback address once per job

The address is the dispatching session's own sc target:

```text
sc agents get --to "id:chat:$SUPERCONDUCTOR_TERMINAL_ID" --output json
```

Usable only when that read succeeds and reports `capabilities.send` and `capabilities.queue`
both true. Record it in the ledger header as `Callback: chat:<terminal-id>`. Anything else —
no `sc`, no `SUPERCONDUCTOR_TERMINAL_ID`, failed read, `send`/`queue` false — means there is
no sc callback address: log `Callback: none`. In a persistent interactive session the harness
task notification is still available — record `Callback: none (harness notification)` and use
it per the table below. In a headless session there is no wake at all: run every dispatch
in-turn. In-turn is always correct, only slower — but a foreground Bash command is killed at the
tool's 10-minute ceiling, so in-turn CLI dispatch is only for runs that fit under it. Never
invent a target; `sc agents list --output json` shows the real ids.

More than one app instance can be running, and a terminal id is only meaningful against the
instance that owns it. `sc instance current --json` names the instance this session belongs
to and `sc instance list --json` shows the rest; when they disagree with where the read
resolved, pin every callback command for the job to that instance with the global
`--socket PATH`. An address resolved against one instance and used against another is a send
that reports success into a different app.

### Who pings back, by vehicle

| Vehicle | Wake mechanism |
|---|---|
| Agent tool (native roles) | Background by default: the call returns an agent id and Claude Code's task notification is the wake (measured 2026-09-27 on 2.1.283). Verify per session rather than assuming: Claude Code 2.1.232 made non-teammate agent spawns in interactive sessions run in the background by default, where the call returns an agent id and the result arrives later as a task notification. A dispatch that returns an id instead of a report is background, not complete — treat the notification as the wake and never read the id as the result. |
| Registry `mcp` worker | The tool return is the ping. Synchronous. |
| Registry `cli` worker (codex, grok, gpt-*, opencode, omp) with an sc callback | The runner sends it, deterministically, on every exit path including timeout and registry error. |
| Registry `cli` worker without an sc callback | Launch the runner with Bash `run_in_background`; the harness notifies the session when the process exits, on every exit path. Evidence, and its limits: runner metadata in two projects shows long runs finishing with `callback: null` (the longest 3588s), and a project ledger records launching the runner, or a lane script wrapping it, as a background Bash task with the harness notification as its wake — but no metadata records the wake itself. The directly measured wake is a background Agent-tool subagent (2026-09-27, 2.1.283), and Claude Code documents background Bash tasks as notifying the session on exit; confirm the first such wake in a job before fanning out more than one. Not a wake for a headless session, whose process is gone by the time the worker exits. Never shrink `--timeout` to fit a foreground call: about twenty foreground runs were killed at 540–570s by the Bash ceiling, well inside their records' timeouts. |
| sc-managed role agent | The brief's mandatory final action sends it; `sc agent wait` remains the fallback. Launch the role with `--ui chat` — a terminal target parks in `review` after its turn, where an unqueued send reports success without running and reads return no content, which disables the fallback. |
| `sc team run` fan-in | **No verified wake.** `--notify self` sets `fan_in_notified: true` once sc hands the completion to the registered creator, but a headless session that already ended its turn is not restarted by it (observed 2026-07-30, run `d927b26078e8`: both roles reported, notified true, no turn). Either block with `sc agent wait --to label:<role> --idle` before ending the turn, or write `Poll: sc team status --run <id>` into the row and read the roles' `report.result_file` on the next turn. A run that was nonterminal when the app restarted becomes Interrupted and is never resumed, so that poll can await a completion that will never arrive: treat an Interrupted status as a failed dispatch and re-dispatch. |
| Native cross-session messaging (`SendMessage` / inbox socket) | **No wake for an sc-managed session.** Claude Code 2.1.224+ binds a per-session inbox socket and starts a new turn when an idle session receives a message, but an sc-managed session's process does not exist between turns: measured 2026-08-09, 75s after a turn ended the registry held no entry for that `sessionId` and there was no socket to post to. Counts as no wake signal here. Unresolved, not refuted, for an orchestrator whose process persists — see below. |

On those vehicles Claude, Codex, and Grok are all covered — not because each model is asked to be polite, but
because the ping is emitted by the wrapper that owns the process, and only falls back to a
model instruction where no wrapper exists.

### Native cross-session messaging — measured, not a wake for sc-managed sessions

Claude Code 2.1.224 (macOS and Linux) added `ListAgents` and `SendMessage`. Every
session that has the feature — including `claude -p`, but not bare mode — binds its own
inbox socket, restricted to the operating-system user, and exports the path as
`CLAUDE_CODE_MESSAGING_SOCKET` to hooks and Bash commands
before any hook runs, `SessionStart` included. Same-machine delivery goes over that socket and
never reaches Anthropic servers. A message arriving mid-turn is read between tool calls; a
message arriving at an **idle** session starts a new turn. Confirmed present in an sc-managed
headless session here on 2.1.226.

Each session registers itself at `~/.claude/sessions/<pid>.json` — `pid`, `sessionId`, `cwd`,
`messagingSocketPath`, `peerProtocol`, and a derived `name` — and the registry lists live
sessions only. Each session exports *its own* socket, never one inherited from a parent, so a
worker that is itself a Claude session sees its own inbox in `CLAUDE_CODE_MESSAGING_SOCKET`,
not the orchestrator's.

**Measured 2026-08-09, and it settles the vehicle for sc.** An sc-managed session does not
survive its own turn. Across three consecutive turns of one conversation the `sessionId` stayed
`0a35309f…` while the pid went 85603 → 80666 → 88282 → 92760, the socket path moved with it,
and the derived name changed every time (`autopilot-45` → `autopilot-29` → `autopilot-4b`). A
detached probe that slept 75s past the end of a turn and then read the registry found **no
entry at all** for that `sessionId`: the process is gone between turns, there is no socket to
connect to, and nothing to wake. `sc agent send --queue` persists a wake across that gap
precisely because it is a queue and not a socket.

So the vehicle is settled negative where Autopilot actually runs, and sc queueing stays
mandatory for sc-managed orchestrators. It is *not* settled negative in general: a persistent
interactive session on the same machine stayed registered across the whole window, so the
mechanism is real for a `claude` session someone is sitting in front of.

Two addressing consequences hold regardless, and both would silently misfire:

- **Never carry a socket path across a turn boundary.** By the time a worker finishes, the path
  it captured at dispatch is gone. Carry the `sessionId` and resolve it against the registry at
  send time.
- **Never address a peer by name across a turn boundary.** The derived name is regenerated on
  every respawn, so a stale name either matches nothing or, on a busy machine, matches a
  different session. `sessionId` is the only stable handle observed.

The remaining conditions below are unresolved and would still have to be cleared before any
non-sc use of this channel:
- **The inbound default holds messages in bypass sessions.** Inbound controls govern the
  *receiver*, which in the callback flow is the dispatching session, not the worker. With no
  `crossSessionInbound` value set, a receiver that bypasses permission prompts delivers only
  what a sender identifying itself as also bypassing sent, and holds anything asserting no
  permission class for approval — which is what a raw socket post from a runner asserts. A `-p`
  session cannot render the approval dialog, so a held message stays held until a mode or
  settings change releases it. An orchestrator that intends to be woken this way therefore
  starts itself with `crossSessionInbound: "accept"` in its `--settings`.
- **Own-child verification is weaker on macOS.** The one exemption to that hold is a message
  Claude Code verifies came from the session's own child process. On Linux it can verify a
  child that has already exited; on macOS only while the posting process still runs, and in a
  container where Claude Code is PID 1 not at all. A `--detach` runner re-execs into its own
  session, so it likely fails verification even though a foreground `--callback` run would pass.
- **Availability is gated.** Unavailable on native Windows and on Bedrock, Claude Platform on
  AWS, Google Cloud's Agent Platform, and Microsoft Foundry, and it is switched off entirely
  when `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `DISABLE_TELEMETRY`, `DO_NOT_TRACK`, or
  `DISABLE_GROWTHBOOK` disables feature-flag evaluation. Any deployment must probe rather than
  assume: `/list-agents` unrecognized means the session does not have it, and `/status` shows
  the session's own address in its `Peer address` row. Delivery is also filesystem-scoped —
  two sessions reach each other only when they see the same registry files, so a session in a
  container and one on the host cannot message each other.

Claude Code 2.1.236 added `notify_when_idle` to `SendMessage`: an opt-in, one-shot request
that another session on this machine send one notice when it next goes idle, with no polling.
It does not change the verdict for sc — an sc-managed orchestrator has no process to notify
between turns — but it is the cheaper form of the experiment below for a persistent
orchestrator, because it is a first-class tool parameter rather than a raw socket post from a
runner, so it sidesteps the own-child verification condition entirely. Run that variant first.

What would qualify it for the table in a context where the orchestrator *does* persist: a
detached `autopilot-worker` run that resolves the orchestrator's `sessionId` against the
registry after that session's turn has ended, posts to the socket it finds, and is observed to
start a new turn there. Run it in both receiver configurations, because one run cannot separate
the failures — under `crossSessionInbound: "accept"` a restart proves reachability and says
nothing about own-child verification, which the `accept` has made moot, while under the default
a silent no-turn is indistinguishable between an unreachable socket and a message held
unverified. A third silent no-turn shares the same signature: a post from inside the sandbox
cannot reach the socket unless `sandbox.network.allowUnixSockets` or `allowAllUnixSockets`
permits it. Pin both the receiver's `crossSessionInbound` and the poster's sandbox
configuration in the experiment record. Anything short of an observed restart is a `delivered`
flag, which the rule above already says is not a wake.

Three further limits apply whatever that experiment shows: messages are plain text only, so a
payload stays the self-describing XML below rather than becoming a structured channel; repeats
from one sender are rate-limited and identical repeats arriving within a short window are
dropped; and a session's unread queue caps at 50, so a fan-out wider than that cannot rely on
the socket alone.

### CLI workers — runner-emitted callback

```text
autopilot-worker run <worker-id> --brief <abs> --workdir <root> \
  --callback chat:<terminal-id> [--detach] [--yes]
```

`--callback` alone keeps the run in the foreground and pings on completion; the ping is
belt-and-braces there. `--detach` re-execs the runner in its own session, returns
immediately, and makes the callback the sole result channel — that is the fan-out mode.
`--detach` requires `--callback` and, for an untrusted record, `--yes` (a detached process
cannot prompt), so approve the resolved command before detaching.

A detached run writes `<out>/<task-id>.pending.json` (task id, worker, pid, callback target,
detached log path, start epoch, timeout) and deletes it on completion. That marker is the
liveness probe for a task that has gone quiet: `kill -0 <pid>` still alive means wait; gone
with the marker present means the runner died without pinging — treat as a failed dispatch
and read the `.detached.log`.

`meta.json` gains `callback: { target, delivered, error }` — `null` when none was requested.
`delivered: false` means the wake was lost; that task will never announce itself.

### sc-managed role agents — brief-embedded callback

Every sc brief carries this block verbatim, in addition to the canonical dispatch fields:

```xml
<callback>
  Your final action, after your report is complete, is exactly one command:
  sc agent send --to id:chat:<terminal-id> --prompt "<autopilot-callback>
  <task_id>T-###</task_id><worker>sc:<role></worker><status>success | failed</status>
  <summary>one line</summary><artifacts>absolute paths</artifacts>
  <instruction>Resume autopilot:orchestrate at command-loop step 7 for this task id;
  the ledger is authoritative.</instruction></autopilot-callback>" --queue
  --idempotency-key autopilot-T-###-a1
  Send it once, whether you succeeded or failed. Do not send anything else, and do not
  spawn agents, teams, or sessions.
</callback>
```

An LLM can forget its final action, so the callback never removes the fallback: an sc task
whose row is still awaiting past its expected duration is reconciled with
`sc agent wait --to label:t-###-<role> --idle --timeout-ms <N>` and `sc agent read`.

#### Launch role agents with `--ui chat`

`sc layout run` accepts `--ui auto|chat|terminal` and `auto` resolves to a terminal target,
which is the wrong target type for a dispatched role. Pass `--ui chat` explicitly — but only
for a provider that supports it. `sc layout capabilities --output json` reports
`terminal_chat_compatible` and `structured_read` per provider, and both are false for several
(observed false for `antigravity`, `copilot`, `factory`, `gemini`, `hermes`, `kiro`,
`prime-agent`, `qwen`; true for `claude`, `codex`, `cursor`, `grok`, `kimi`, `omp`,
`opencode`, `pi`). Read those two flags before choosing a role's provider. A provider with
`terminal_chat_compatible: false` cannot be launched into the safe target type at all, and one
with `structured_read: false` returns a terminal snapshot from `sc agent read` rather than
role/text messages — on either, the reconcile path below is unavailable, so dispatch that role
synchronously or seat it on a chat-capable provider instead. Measured here on 2026-08-09, same
prompt and provider on each target type:

| | `ui: terminal` | `ui: chat` |
|---|---|---|
| State after its turn ends | `review` / `idle`, entered automatically with no human action | `idle` / `idle` |
| `capabilities.queue` | `false` from launch, so `sc agent send --queue` fails `code: "busy"` | `true` |
| `sc agent send` while in `review` | returns `ok: true`, does not run; buffered until a human touches the tab, then fires | n/a, admitted and running within 4s |
| `sc agent read` | terminal snapshot, and **no `lines` key at all** while in `review` | `content_mode: "structured"`, role/text messages |

The `review` state is the trap. It is not a first-launch trust banner — that appears once per
new tab and is unrelated. It is where a terminal target parks after every completed turn, and
while parked it accepts sends that report success and do nothing, and serves reads with no
content. `sc agent wait --idle` has also returned `idle` against a terminal target that was
still mid-turn, so the documented reconcile pair can report a finished task that is running and
a reachable target that is inert.

This does not put the callback at risk. The callback's *receiver* is the orchestrator, which
the address rule above already requires to be a target reporting `capabilities.queue: true` —
a terminal-UI orchestrator has no callback address at all and degrades to synchronous dispatch
rather than trusting a buffered send. The role agent is inferred to send from inside its own
turn, before it parks; the measurements above cover a terminal target's inbound sends only, not
its outbound one.

What breaks is every orchestrator-to-role message after that first turn — a retry, a
clarification, a `judgment.md` follow-up — plus the reconcile path that is supposed to catch a
forgotten callback. Only the unqueued form fails silently. `sc agent send --queue` against a
terminal target fails loudly with `code: "busy"` from launch onward, because the target never
reports `queue: true`, so the brief's `--queue` callback and any queued follow-up are
detectable failures rather than lost ones.

Two operational notes from the same run. `sc layout run tabs` reuses an existing compatible tab
rather than always allocating a new one, and will replace a session already living there;
`sc agents list --output json` before launching shows what is occupied. And `--tab N` is
rejected by the `tabs` shape, so tab placement cannot be pinned that way.

### Callback payload

Assume the woken process is cold. Every payload is self-describing and points at files, not
conversation memory:

```xml
<autopilot-callback>
  <task_id>T-003</task_id>
  <worker>gpt-6-luna-max-cli</worker>
  <status>success | failed | timeout | aborted | error</status>
  <exit>0</exit>
  <workdir>/abs/project</workdir>
  <output>/abs/project/.autopilot/artifacts/T-003.out</output>
  <meta>/abs/project/.autopilot/artifacts/T-003.meta.json</meta>
  <ledger>/abs/project/.autopilot/ledger.md</ledger>
  <instruction>Resume autopilot:orchestrate at command-loop step 7 for this task id.</instruction>
</autopilot-callback>
```

Every send uses `--queue` and an idempotency key that is unique per attempt — the runner uses
`autopilot-<task-id>-<pid>`, an sc brief uses `autopilot-<task-id>-a<attempt>` with the
orchestrator substituting the attempt number. One attempt therefore wakes the session exactly
once, and a retry of the same task still wakes it.

### Turn discipline

- One short dispatch: run it in-turn. A callback buys nothing and costs a wake.
- Fan-out of two or more workers, or any single worker expected to exceed the overlay's
  `callbacks.detachThresholdSec` (default 120s): dispatch all of them out of turn — detached
  with `--callback` when an sc address resolved, otherwise as harness background tasks — write
  an `awaiting` ledger row per task recording the wake channel and expected duration, then
  **end the turn**. Do not poll, do not sleep, do not hold the session open waiting.
- Any CLI worker that may outlast the Bash tool's 10-minute foreground ceiling goes out of turn
  regardless of the threshold. Pass the record's own timeout; the shipped presets' timeouts
  come from observed run lengths and long-turn workers routinely need an hour or more.
- `callbacks.mode: "off"` in the overlay disables the whole mechanism: never detach, always
  wait in-turn.
- Never leave work running with no wake signal. A headless session with no sc address has
  none; a detached process there is silently lost work — run in-turn instead.
- On wake: reconcile the ledger first, then run step-7 intake for the announced task id
  only. Leave other `awaiting` rows awaiting and end the turn again; the last callback to
  arrive is the one that reaches close-out.
- Detached fan-out into one shared working tree is for read-only or non-overlapping work
  only. Concurrent writers invalidate the checkpoint protocol — baselines, `changedFiles`,
  and reset attribution all assume one writer. Parallel code briefs that touch overlapping
  paths need isolation, which requires the user's explicit request: `sc worktree create` on
  the sc path, or the Agent tool's `isolation: "worktree"` for native roles. Background
  Agent-tool subagents are the default now, so two background writers in one tree is the easy
  mistake — serialize them unless they are isolated.

### Native worktree isolation

Measured 2026-09-27 on Claude Code 2.1.283. An Agent-tool dispatch with
`isolation: "worktree"` runs in `<repo>/.claude/worktrees/agent-<id>` on a new branch
`worktree-agent-<id>`, created from the **committed** `HEAD`. The dispatch returned in the
background and its completion notification woke the session. A worktree the agent left
unchanged is removed automatically; one with changes is kept, locked, for the orchestrator.

- Commit (or deliberately leave out) everything the brief depends on before dispatching.
  Uncommitted state in the main tree is invisible inside the worktree, and a brief that
  assumes it will be implemented against the wrong baseline.
- Record the worktree branch and the baseline commit in the ledger row. Intake reads the
  diff `baseline..worktree-agent-<id>`, not the main tree.
- Integrate only after intake passes: merge or cherry-pick the branch into the main tree,
  then remove the worktree and delete the branch. A dropped task is removed the same way.
- Keep `.claude/worktrees/` in the project's `.gitignore` next to `.autopilot/`, so live
  worktrees never show up as untracked work in the main tree.
- Isolation is for parallel writers on overlapping paths and needs the user's explicit
  request, like `sc worktree create`. A single writer, or writers on disjoint paths, share the
  main tree under the checkpoint protocol.

## T1 — Design to architect

```xml
<dispatch>
  <to>architect</to>
  <task_id>T-001</task_id>
  <domain>design</domain>
  <system>You are the architect. Compare options and produce concrete interfaces, not production code.</system>
  <context>[complete background]</context>
  <objective>[design artifact]</objective>
  <acceptance_criteria>
    - Concrete interface types
    - At least two options with trade-offs
    - Risks and mitigations
  </acceptance_criteria>
  <output_format>Markdown design document</output_format>
  <redlines>[scope exclusions]</redlines>
  <materials>[specifications and prior decisions]</materials>
</dispatch>
```

## T2 — Implementation

Use `engineer` for code/data, `engineer-doc` for document/visual, and
`security-engineer` whenever security applies.

```xml
<dispatch>
  <to>engineer</to>
  <task_id>T-002</task_id>
  <depends_on>T-001</depends_on>
  <domain>code</domain>
  <system>Implement the authoritative design exactly. Do not redesign; record concerns in IMPLEMENTATION NOTES.</system>
  <context>[complete background and design path]</context>
  <objective>[implementation outcome]</objective>
  <acceptance_criteria>
    - Every required interface implemented
    - Relevant lint/compile/test checks pass
    - Named error paths exercised
  </acceptance_criteria>
  <output_format>Files plus evidence and IMPLEMENTATION NOTES</output_format>
  <redlines>[do-not-touch scope]</redlines>
  <materials>[design, references, real fixtures]</materials>
</dispatch>
```

Visual T2 criteria additionally require every created/changed page or slide rendered to
images and visually inspected, with viewed pages listed.

## T3 — Research to architect

```xml
<dispatch>
  <to>architect</to>
  <task_id>T-003</task_id>
  <domain>research</domain>
  <system>Investigate and recommend. Source claims, mark uncertainty, and never modify files.</system>
  <context>[decision this research informs]</context>
  <objective>[question]</objective>
  <acceptance_criteria>
    - Every option receives adopt, reject, or needs-user-decision
    - Every verdict has evidence
    - Uncertainty is explicit
  </acceptance_criteria>
  <output_format>Markdown research report</output_format>
  <redlines>Read-only</redlines>
  <materials>[starting sources]</materials>
</dispatch>
```

## T4 — Batch or refactor

```xml
<dispatch>
  <to>engineer</to>
  <task_id>T-004</task_id>
  <domain>code</domain>
  <system>Apply the specified pattern across scope. Skip and list ambiguous cases; never guess.</system>
  <context>[reason and scope]</context>
  <objective>[exact transformation]</objective>
  <acceptance_criteria>
    - Pattern applied consistently
    - Redlined files untouched
    - Before/after change list and skipped list
  </acceptance_criteria>
  <output_format>Changes, skips, and verification output</output_format>
  <redlines>[do-not-touch list]</redlines>
  <materials>[correct examples]</materials>
</dispatch>
```

## T5 — Arbitration

After round three still has blocking findings:

```xml
<dispatch>
  <to>architect</to>
  <task_id>T-005</task_id>
  <domain>[original domain]</domain>
  <system>Arbitrate after three failed review rounds. Return REDESIGN or OVERRIDE; justify the decision per finding.</system>
  <context>[design, latest artifact, every review round, every revision]</context>
  <objective>Resolve the disagreement finally.</objective>
  <acceptance_criteria>
    - Explicit REDESIGN or OVERRIDE
    - Replacement design, or finding-by-finding override rationale
  </acceptance_criteria>
  <output_format>Markdown arbitration decision</output_format>
</dispatch>
```

## T6 — External worker

The canonical brief remains unchanged; this wrapper records registry selection and intake.

```xml
<external_dispatch>
  <worker_id>registered-worker-id</worker_id>
  <model_family>registry modelFamily</model_family>
  <capability>code | refactor | test | review | docs | data | security | research | design</capability>
  <brief_path>[absolute .autopilot/dispatch/T-###.md path]</brief_path>
  <runner>~/.autopilot/bin/autopilot-worker</runner>
  <callback>chat:&lt;terminal-id&gt; | none (harness notification or in-turn)</callback>
  <mode>foreground | detached</mode>
  <intake>spot-check + conditional red-team + criterion sign-off + native verifier (R7; always fires for external workers)</intake>
</external_dispatch>
```

CLI invocation:

```text
~/.autopilot/bin/autopilot-worker run <worker-id> --brief <absolute-brief> --workdir <project-root> \
  [--callback chat:<terminal-id>] [--detach] [--yes]
```

Subagent records use the Agent tool. MCP records use the named MCP tool with resolved
`argsTemplate`. Normalize every result to `{ outcome, artifacts[], exit, evidence }`.

## sc-managed dispatch (super.engineering)

When startup detection found sc (CLI on PATH, `sc agents list --output json` succeeds),
role dispatches run as labeled sc agents instead of Agent-tool subagents. Registry `cli`
and `mcp` workers are unaffected. The brief is unchanged and fully self-contained: an sc
session carries no plugin agent frontmatter, so the `<system>` block is the entire role
identity, and every sc brief must state that the agent may not spawn further agents,
teams, or sessions.

1. Launch, first prompt only: `sc layout run panes ... --label t-###-<role> --output
   json` with the brief as the prompt. Consult `sc layout run --help` once per session
   for prompt-input flags; pass long briefs with `--from-file <abs>` rather than inline.
   Put the `<system>` block in `--system-prompt` instead of folding it into the prompt — an sc
   session carries no plugin agent frontmatter, and this is the field for role identity.
   `sc layout capabilities --output json` resolves `--provider` only: it lists provider keys
   and the compatibility flags above, and carries **no model ids and no reasoning levels**.
   Take `--reasoning` from the effort policy in `roles.md`, and omit `--model` so the provider
   default applies unless the user named a model id — never invent one, and never read one out
   of capabilities. Include the `<callback>` block from the callback section, with the task id
   and terminal id already substituted.
2. Collect the result one of two ways. A single short dispatch waits in-turn:
   `sc agent wait --to label:t-###-<role> --idle --timeout-ms <N> --output json`. A fan-out,
   or any agent expected to run for minutes, relies on the callback: mark the row `awaiting`
   and end the turn. Either way the wake is explicit — never end a turn hoping a background
   notification arrives on its own.
3. Read the report with `sc agent read --to label:t-###-<role> --last <N> --output json`,
   then inspect the real artifacts on disk — the transcript is a claim, not evidence.
4. Follow-ups — retry with attached output, revision rounds, reviewer findings — go to the
   same agent via `sc agent send --to label:t-###-<role> --prompt <text> --queue
   --output json`, never a second `sc layout run` for the same worker. `--queue` and
   `--wait-until-idle` are alternatives: `--queue` admits the message immediately and fails
   loudly with `code: "busy"` against a target that never reports `queue: true`, while
   `--wait-until-idle` blocks until the target is free and then dispatches. Keep `--queue` for
   the callback and for any send that must not hold the turn open; use `--wait-until-idle` only
   for an in-turn follow-up to a target already known to be mid-run. Neither confirms turn
   completion — that is still `sc agent wait --idle` plus `sc agent read`.

`sc agent subscribe --to label:t-###-<role>` streams that target's events for an in-turn watch
and emits a `target_error` before stopping when the provider's turn fails, which distinguishes
a crashed role from a slow one without polling `sc agent read`. A long-running role brief may
call `sc agent should-stop --self` at checkpoints so an orchestrator cancellation is honoured
between steps rather than only by `sc agent stop`. Neither is a wake: both need a live
orchestrator process, so they belong to in-turn paths only.

`sc agents group create` plus `sc agent send --to group:<name>` may fan one shared
announcement to independent workers. `sc coordination-state get|set` (with `--if-version`
under concurrency) holds shared machine-readable decisions; the ledger remains
authoritative over coordination-state. Parallel code briefs with overlapping paths use
`sc worktree create --prompt <complete brief>` for true worktree isolation instead of
sharing the working tree.

sc dispatches produce no runner `meta.json`: capture `git rev-parse HEAD` before launch
and record it in the ledger, exactly as for native Agent-tool dispatches. Intake gates,
verification, escalation counts, and the checkpoint protocol are identical. Any sc
failure — launch error, wait timeout, unreadable session — falls through to the
Agent-tool native role or a registry worker with the same brief; log the degradation and
count the attempt against the same three-round cap.

## Checkpoint protocol

Before each dispatch, ensure the working tree is clean so failed work can be reverted:

1. Ensure `.autopilot/` is listed in the target project's `.gitignore` before the first
   stash or clean. Otherwise `git stash --include-untracked` removes briefs, the ledger,
   and artifacts from the working tree, and `git clean -fd` deletes them permanently.
2. If the tree is dirty with prior successful work, stash it:
   `git stash --include-untracked -m "autopilot: before T-###"`.
   In a repo with no commits, stash fails; skip the stash (and the reset protocol) when
   `baselineRef` is null.
3. Record the baseline ref. For CLI dispatches, read `baselineRef` from the runner's
   `meta.json`. For native Agent-tool and sc-managed dispatches, capture
   `git rev-parse HEAD` before dispatching and record it in the ledger's Notes column. A null baseline means no
   checkpoint was taken (non-git directory or repo before its first commit); skip reset.
4. On success and `CONFIRMED`: pop the autopilot stash if one was created. Select it by
   message: find the `stash@{n}` matching `autopilot: before T-###` via `git stash list`,
   then `git stash pop stash@{n}`. If the pop produces merge conflicts, resolve in favor
   of the worker's verified changes: `git checkout --theirs -- <conflicted paths>`,
   `git restore --staged <conflicted paths>`, then `git stash drop stash@{n}`.
5. On `REFUTED`, worker failure, or timeout: first reset tracked files, then clean untracked
   worker artifacts, then pop the stash. Order matters — cleaning before the pop is safe
   because stashed files live inside the stash object, not on disk.
   ```
   autopilot-worker reset --to <baselineRef> --workdir <root> --clean
   git stash pop stash@{n}   # select by autopilot message label
   ```
6. On escalation (second failure): reset and clean before handing to the next worker so it
   receives a clean tree, not debris from two failed attempts. Pop the stash after the
   escalated worker completes.
7. On dependent rollback (component A needs reverting after B built on it): reset to A's
   baseline ref, which also reverts B and any unrelated successful tasks committed between
   them. Re-dispatch both; note the collateral scope in the ledger.

The runner writes `changedFiles`, `untrackedFiles`, and `manifestComplete` to `meta.json`
after every CLI dispatch. `changedFiles` includes files the worker committed, not only
uncommitted modifications. `manifestComplete: false` means a git command failed or timed
out — the manifest is incomplete and should not be trusted for overlap analysis.

For sequential dispatch forensics, compare `changedFiles` across meta.json outputs to
identify which dispatch touched which files. Do not use this for parallel overlap
detection — in a shared working directory, concurrent runners see each other's changes and
produce misleading manifests. True parallel isolation requires worktree support.

## Escalation and practical rules

- First failure: retry the same worker with captured output and metadata in materials.
- Second failure: use the native engineer (security-engineer for security) with the full
  trail. Reset to the baseline ref before the first attempt so the native worker starts
  clean.
- A third attempt changes worker, approach, or model, or asks the user—never a blind retry.
- Independent briefs may dispatch in parallel; dependent briefs receive upstream artifacts.
- A dispatch has significant fixed context overhead (often tens of thousands of tokens);
  batch micro-work.
- Background processes need closed stdin, an explicit timeout, deterministic output, and a
  resolved callback target. A detached process with nowhere to ping back is lost work.
- Callback idempotency keys are per run, not per task (`autopilot-<task-id>-<pid>`), so a
  retry of the same task id still wakes the session while one run never wakes it twice. A
  hand-written sc callback must follow the same rule: vary the key per attempt.
