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
| Job-created scratch files | Job close-out | Delete only scratch files created by that job |

Archives are append-only; deleting one requires the user.
