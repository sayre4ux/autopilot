# Autopilot eval suite

Cases for `claude plugin eval`. Each run is a fresh `claude -p` child on your own credential,
so every run costs real tokens.

| Group | What it checks | Tags |
|---|---|---|
| `routing/` | `autopilot:orchestrate` auto-enters a multi-component build and stays out of document work and one-file fixes | `routing`, `cheap` |
| `doctrine/` | The loaded doctrine answers the 0.2.0 way: senior-engineer routing and effort, the Fable guard, background wake for long CLI workers | `doctrine`, `cheap` |
| `effort/` | The same correctness-heavy task (SemVer 2.0.0 precedence) dispatched to `engineer` (opus/medium) and `senior-engineer` (opus/high). Compare the two case scores: this is the evidence behind the effort split | `effort` |
| `model/` | A gitignore(5) matcher dispatched to `engineer` on opus, on haiku at medium and high, and to `engineer-lite`. Graded by git itself through a hidden checker: this is the evidence behind `engineer-lite` | `model` |

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

## Model comparison (`model/`)

Each case sends the same brief: write `gitignore_match.py` with
`is_ignored(gitignore, path) -> bool` that agrees with git, standard library only. After the
agent reports, the main session runs `evals/model/_shared/check_gitignore.py`, which the
scaffold stages under `$HOME/.eval-check/` so the agent never sees it. The checker builds
nine fixture trees, asks `git ls-files --others --ignored --exclude-standard` which files
each `.gitignore` ignores, and compares 96 paths. Git is the oracle, so no expected answers
are stored on disk. The cases need `--scaffold` (it stages the checker) and the same tool
grants as the effort cases:

```bash
claude plugin eval . --tag model --ablation none --no-publish --scaffold -j 3 \
  --allow-tools Agent Write Edit "Bash(python3:*)" "Bash(pytest:*)" "Bash(uv:*)" --max-cost-usd 15
```

`engineer-gitignore-haiku-high` loads a second, eval-only plugin from its `eval-plugin/`
folder: a copy of `agents/engineer.md` on haiku at effort high, since the Agent tool takes a
per-call model but no per-call effort. `tests/test_eval_fixtures.py` keeps that copy in step
with `agents/engineer.md`.

Results from 2026-10-24, five runs per case (Claude Code 2.1.309). Cost is per run and
includes the opus main session, about $0.14 of every run:

| Case | Passed 96/96 | Mean cost | Median time |
|---|---|---|---|
| `engineer-gitignore-opus` (opus, medium) | 5/5 | $1.08 | 327 s |
| `engineer-gitignore-haiku` (haiku, medium) | 5/5 | $0.17 | 198 s |
| `engineer-gitignore-haiku-high` (haiku, high) | 5/5 | $0.20 | 314 s |
| `engineer-lite-gitignore` (shipped `engineer-lite`) | 5/5 | $0.15 | 107 s |

The task does not separate the models on correctness. It shows that for a fully specified
single-file task haiku matches opus at a small fraction of the worker cost, and that `high`
adds time and cost without changing the result. It says nothing about multi-file or
design-bearing work.

Known limit: the eval sandbox runs the system `python3`, which has no pytest and cannot
install it, so no agent could run its own tests. The `matches-git` grader is the only
correctness evidence. The first haiku-high run also scored 1/5 because the checker did not
register the candidate module in `sys.modules`, which breaks `@dataclass`; the checker is
fixed and the table shows the rerun.
