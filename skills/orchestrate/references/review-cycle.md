# Review cycle

Review is optional and additive. Verification of above-threshold code remains mandatory
even with review off.

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
--output json` lists one. Fresh session equals fresh context; never reuse the producer's
sc agent for its own review.

## Severity

| Severity | Definition | New round |
|---|---|---:|
| critical | Broken behavior, security flaw, data-loss risk, factual error | yes |
| major | Wrong logic, specification violation, significant gap, misleading content | yes |
| minor | Non-blocking improvement, clarity, suboptimal pattern | no |
| nit | Formatting, naming, preference | no |

## Loop

1. Reviewer receives the deliverable, authoritative spec, and original criteria in a
   self-contained review block.
2. With no critical/major findings, pass and collect minor/nit notes.
3. With blocking findings, send the complete findings and artifact back to the implementer.
4. Review the revision in fresh context.
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
