# Autopilot eval suite

Cases for `claude plugin eval`. Each run is a fresh `claude -p` child on your own credential,
so every run costs real tokens.

| Group | What it checks | Tags |
|---|---|---|
| `routing/` | `autopilot:orchestrate` auto-enters a multi-component build and stays out of document work and one-file fixes | `routing`, `cheap` |
| `doctrine/` | The loaded doctrine answers the 0.2.0 way: senior-engineer routing and effort, the Fable guard, background wake for long CLI workers | `doctrine`, `cheap` |
| `effort/` | The same correctness-heavy task (SemVer 2.0.0 precedence) dispatched to `engineer` (opus/medium) and `senior-engineer` (opus/high). Compare the two case scores: this is the evidence behind the effort split | `effort` |

Smoke run, one run per case, plugin arm only, report kept local:

```bash
claude plugin eval . --runs 1 --ablation none --no-publish
```

Full run with the no-plugin baseline (default 3 runs per arm) and a cost ceiling:

```bash
claude plugin eval . --no-publish --max-cost-usd 5
```

In the two-arm run, the `orchestrate-fired` grader is a plugin-fired indicator rather than
part of the score; the `orchestrate-not-fired` graders set `arm: both` so they score in both
arms.

The effort cases dispatch real subagents that write and run code, so they need tool grants and
cost more. Run them plugin-only (the baseline arm cannot dispatch plugin agents):

```bash
claude plugin eval . --tag effort --ablation none --no-publish --judge-model sonnet \
  --allow-tools Agent Write Edit "Bash(python3:*)" "Bash(pytest:*)" "Bash(uv:*)" --max-cost-usd 10
```

Use `--judge-model sonnet` here. In the first run (2026-09-28, default Haiku judge), Haiku failed
one engineer run 0/3, but that `semver.py` passed the full SemVer 2.0.0 precedence chain, every
rule check, and every invalid-input check when executed.

Result of that run, corrected for the judge error: both roles produced correct code 3/3.
`engineer` (medium) averaged $0.41 and about 90s per run, `senior-engineer` (high) $0.53 and
about 135s. This task does not separate the two efforts, so it supports `medium` as the default
but is not yet evidence for or against `high`. A harder task is needed for that.
