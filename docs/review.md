# Adversarial review

Review is optional (`off`, `final`, `per-component`) and, when it runs, adversarial on
both sides. Producers are briefed to pass in one round: every confirmed blocking finding
is recorded against their work, and disclosure is always cheaper than concealment — a
limitation reported with evidence costs nothing, a defect the panel finds that the report
glossed over costs the most.

The final gate runs a panel of at least two independent reviewers (`reviewPanelSize`,
default 2), launched in parallel with fresh contexts and no visibility into each other,
preferring distinct model families. Each reviewer presumes the deliverable defective and
must earn a `PASS` with evidence of absence. Findings merge by union — one reviewer's
silence never weakens the other's finding — and are cross-scored: confirmed defects a
reviewer missed, and findings that dissolve under the orchestrator's check, are both
recorded and feed future reviewer selection. Blocking findings cap at three rounds before
architect arbitration. A single usable reviewer degrades to a solo review, logged, never a
broken loop.

## Field results

Numbers from one multi-week production build (a Rust sandboxing CLI) run end-to-end under
Autopilot — observational results from real work, not a controlled benchmark:

- Independent cross-family review confirmed **25+ critical/major defects in code that had
  already passed compile and its test suite** — among them an IPv6 containment bypass, a
  destructive-uninstall safety hole, and a teardown race that killed live sessions.
- Two-reviewer panels earned their cost directly: on identical briefs, the reviewers'
  critical findings were **disjoint** — each found criticals the other missed. A solo
  reviewer would have shipped one either way.
- The false-positive filter worked in both directions: 3 review findings were refuted by
  evidence and never reached the implementer.
- Across 54 external-worker dispatches (three model families), **no failed dispatch lost
  work** — every failure recovered by retry, continuation brief, or family switch.
- The project's own test suite grew from 5 to 224 passing tests over the ledger's ~70
  tasks.
