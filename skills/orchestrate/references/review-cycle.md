# Review cycle

Review is optional and additive. It never substitutes for intake, and it does not change
whether the verifier runs — that is R7 in `judgment.md`, evaluated independently of mode.

## Modes

| Mode | Timing |
|---|---|
| `off` | No review cycle |
| `final` | Once after assembly |
| `per-component` | After each component, with optional integration review |

## Reviewer selection

Select an enabled worker with `review` capability, preferring a `modelFamily` different
from the producer. A CLI worker runs through the runner; an MCP worker through its tool; a
subagent through the Agent tool. If none is usable, dispatch native `reviewer`. Log the
fallback. Review unavailability never breaks execution.

Under sc-managed orchestration, the reviewer (and verifier) launches as a fresh labeled sc
agent, preferring a provider different from the producer's when `sc layout capabilities
--output json` lists one as `available`. Restrict that choice to providers reporting
`terminal_chat_compatible: true` and `structured_read: true` — a reviewer seated elsewhere
cannot be launched into a chat target and returns a terminal snapshot instead of a readable
report, which defeats the point of a separate reviewer. If no second provider clears both
flags, keep the producer's provider and take the independence from the fresh session. Fresh
session equals fresh context; never reuse the producer's sc agent for its own review.

## Adversarial panel

The final gate — the review in `final` mode, or the integration/last review in
`per-component` — runs a panel of at least two reviewers (overlay `reviewPanelSize`,
default 2). Panel members launch in parallel with fresh contexts and identical review
blocks, with no visibility into each other's findings. Diversify the panel: prefer distinct
model families across members, mixing a review-capable registry worker with the native
reviewer when both exist. Every review dispatch, solo or panel, carries the adversarial
instruction in the `dispatch.md` review block — the reviewer assumes the deliverable is
defective, and a panel member knows a rival reviews the same artifact and that misses and
dissolved findings are both recorded.

If only one usable reviewer exists, run solo and log the degradation; review
unavailability never breaks execution.

### Merge protocol

1. Union the findings, deduplicating by location and defect; on severity disagreement keep
   the higher unless artifact evidence refutes it.
2. One reviewer's silence never weakens the other's finding — independence means union,
   not consensus.
3. Spot-check every blocking finding against the artifact before acting. A finding the
   evidence refutes is dropped and recorded against its reviewer; a finding that cannot be
   checked cheaply stays blocking (fail-closed) and travels to the implementer, who may
   rebut it with evidence in the revision.
4. Record per-reviewer misses of confirmed blocking findings, and dropped false findings,
   in the ledger Notes. This credibility record feeds future reviewer selection and
   `lessons.md`.

## Severity

| Severity | Definition | New round |
|---|---|---:|
| critical | Broken behavior, security flaw, data-loss risk, factual error | yes |
| major | Wrong logic, specification violation, significant gap, misleading content | yes |
| minor | Non-blocking improvement, clarity, suboptimal pattern | no |
| nit | Formatting, naming, preference | no |

## Loop

1. Each reviewer receives the deliverable, authoritative spec, and original criteria in a
   self-contained review block — the full panel at the final gate, solo otherwise.
2. Merge per the panel protocol. With no surviving critical/major findings, pass and
   collect minor/nit notes.
3. With blocking findings, send the complete merged findings and artifact back to the
   implementer.
4. Review the revision in fresh context: one fresh reviewer with every prior finding
   attached, checking each fix and scanning the revision for regressions.
5. If round three still blocks, send design, latest artifact, every finding, and every
   revision to architect using T5.

Architect returns:

- `REDESIGN`: provide a replacement design and restart implementation.
- `OVERRIDE`: accept the artifact with justification for every dismissed finding.

The decision is final for that component and is logged.

## Integration and notes

In per-component mode, run an integration review when shared state, interfaces, callbacks,
or other interactions create behavior not proven component-by-component. Use the same
three-round cap.

Expose non-blocking findings:

```markdown
## Review Notes

- [minor] path:line — future improvement
- [nit] path:line — naming or formatting preference
```
