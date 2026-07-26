# Maintenance

## Change tiers

| Tier | Change | Rule |
|---|---|---|
| Safe | Example, typo, non-semantic clarification | May proceed |
| Careful | Merge rules, add a template, adjust routing | Record the rationale in lessons |
| Structural | Hard rule, role set, or command-loop step | Obtain user approval first |

Treat uncertain classification as the higher tier.

## Lessons

Runtime lessons live in `<project>/.autopilot/lessons.md`, not in the plugin. Search before
adding. Increase a hit count for recurrence; harden a lesson with three or more hits into
the appropriate rule and compress the old entry.

```markdown
## YYYY-MM-DD — Short title

**What happened**: Evidence-backed description.
**Root cause**: One sentence.
**Fix applied**: One sentence.
**Hit count**: 1
```

New judgment failure modes belong in `judgment.md`; new dispatch shapes belong in
`dispatch.md`; worker-specific routing belongs in the registry record.

## Devlog — cross-agent handover

A devlog is the committed, tool-neutral handover surface: it lets a cold agent from any
harness — a fresh Claude session, a direct Codex run, anything reading the repo — pick up
the work. It is presence-activated: when the target project has a root `DEVLOG.md`,
close-out maintains it; when absent, never create one uninvited.

Shape — one rewritten State header, then append-only numbered entries:

```markdown
# Devlog

## State
One screen maximum, current facts only: what works now, what is in flight, open items,
and the exact commands to verify. Rewritten at every close-out; retire stale claims.

## §N — YYYY-MM-DD — Title
What changed and why, verification evidence (commands with key output, or commit refs),
open items. Entries are immutable; corrections are new entries.
```

Rules:

- Single writer. The orchestrator writes at close-out, one entry per job covering the
  rows it closes. Workers never append — parallel writers corrupt entry numbering and the
  State header; their evidence arrives in reports and the orchestrator carries it in.
- With a devlog present, ledger Notes hold state and pointers (`see DEVLOG §N`), never
  narrative. Narrative that outgrows a Notes cell is the signal the project needs a devlog.
- Briefs cite `DEVLOG.md` in `<materials>` when its State section bears on the task.
- The devlog earns its keep only if every harness finds it: recommend the project
  reference it from both `CLAUDE.md` and `AGENTS.md`. Work done outside Autopilot follows
  the same entry shape via that pointer; Autopilot only guarantees its own close-outs.
- Devlog versus the other surfaces: ledger is harness-internal task state, lessons are
  reusable failure patterns, artifacts are deliverables. The devlog is the only surface
  that survives both a context reset and a change of vendor.

## Preventing decay

- Bloat: prefer an example under an existing rule; if reference doctrine exceeds roughly
  50 KB, merge or retire.
- Ghost files: periodically confirm every reference is linked and used.
- Ritualization: repeated finding-free reviews call for a sharper review prompt, not an
  assumption that quality became perfect.

## Step 9 housekeeping

| Target | Trigger | Action |
|---|---|---|
| `.autopilot/ledger.md` | More than 25 done/dropped rows | Append all but 10 newest completed rows to `.autopilot/archive/ledger-<year>.md`; never archive open/active/blocked |
| `.autopilot/dispatch/*.md` | Its row was archived | Delete the regenerable brief |
| `.autopilot/artifacts/*` | Its row was archived | Never auto-delete; report orphans |
| `.autopilot/lessons.md` | More than 30 entries or 15 KB | Merge duplicates and harden recurring lessons |
| Reference doctrine | More than 50 KB | Flag a merge/retire pass |
| `DEVLOG.md` State section | Exceeds one screen (~40 lines) | Rewrite: current facts only, details stay in entries |
| Job-created scratch files | Job close-out | Delete only scratch files created by that job |

Archives are append-only; deleting one requires the user.
