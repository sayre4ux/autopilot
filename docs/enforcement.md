# Enforcement and the mod

Autopilot includes optional fail-open hooks in two parts: Python command hooks, which run on
any build that runs command hooks (including `claude -p` and CI), and a function-hooks mod
(`hooks/register.tsx`) that needs a mods-capable build. `advisory` is the default.

Command hooks:

- The Bash guard recognizes a deliberately small set of catastrophic commands. Strict mode
  denies a positive match; advisory mode turns it into a permission prompt with the reason, so
  a person sees it before it runs.
- The brief check runs on Agent-tool dispatches of `autopilot:architect`, `engineer`,
  `senior-engineer`, `engineer-doc`, and `security-engineer`. It looks for a non-empty
  `<acceptance_criteria>` block, or a markdown "Acceptance criteria" heading with content, in
  the inline `<dispatch>` block or in the `.md` brief path(s) named in the prompt. Advisory
  mode adds a note to the model's context; strict mode denies the dispatch. A brief it cannot
  read is not judged. Reviewer, verifier, and supervisor dispatches are exempt.
- The Stop hook shows a message when the ledger still has active/open rows. The shipped
  ledger has no session column, so every such row counts. Only when this session's id appears
  in the ledger does it narrow to the rows carrying that id.

The mod:

- **Fable gate.** When the session's main model is Fable, `autopilot:security-engineer` is
  hidden from the model's agent list and refused at dispatch, in advisory and strict alike. A
  spawn that gets past that is denied in strict and shown as a toast in advisory. The
  orchestrator doctrine (tell the user, recommend restarting on `opus`) still applies.
- **Nested-spawn backstop.** A spawn whose parent is an `autopilot:*` agent is denied in strict
  and shown as a toast in advisory. No autopilot role lists the Agent tool, so this fires only
  for a misconfigured role; it does not catch a general-purpose agent carrying a role brief.
- **`/ledger`.** A read-only pane showing `.autopilot/ledger.md`: the job, review mode and
  vehicle, a progress bar, then the rows still in play (active, awaiting, blocked, open) with
  their notes wrapped to three lines. Done and dropped rows fold into one line; `d` (or the
  Show done button) lists them. Model shows as alias and effort (`opus·high`), and widths
  count CJK characters as two cells. Refresh (`r`) and Close (`c`) buttons; the pane refreshes
  at the end of each main-loop turn while open. The status line reads `autopilot: N active · M awaiting`. In `claude -p` or
  an SDK host with no surface it answers with a text summary. It never writes a file and works
  even with enforcement `off`. Command names cannot contain `:`, so it is `/ledger` rather than
  `/autopilot:ledger` and shares the global command namespace.

The mod sees only Agent-tool dispatches. sc-managed role agents run as separate processes and
registry CLI workers run through the runner; neither is visible to it, and on those paths the
doctrine text is the only enforcement.

Any hook parsing, runtime, or platform error allows the operation. A broken hook must not
brick Bash or trap a session.

Set plugin user configuration `enforcement` to `off`, `advisory`, or `strict`:

| Mode | Behavior |
|---|---|
| `off` | No enforcement; the `/ledger` view still works |
| `advisory` | Ask before catastrophic Bash commands, warn the model about briefs without acceptance criteria, hide `security-engineer` from a Fable session |
| `strict` | Deny those Bash commands and criteria-less briefs, hide `security-engineer` from Fable, refuse spawns from inside an autopilot role |

The Python hooks resolve the mode from that setting, then from `enforcement` in
`~/.autopilot/config.jsonc`, then default to `advisory`. The mod reads only the plugin
setting. `disableAllHooks` or `--safe-mode` stops the mod and the command hooks while skills
and agents still load. The plugin can also be disabled entirely from `/plugin`.
