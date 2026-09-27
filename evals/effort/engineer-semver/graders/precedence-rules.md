---
type: llm
weight: 3
focus:
  source: file
  path: semver.py
---
Judge `semver.py` against SemVer 2.0.0 precedence. PASS only if every rule holds:
1. MAJOR, MINOR, PATCH compare numerically (1.10.0 > 1.9.0).
2. A pre-release version has lower precedence than the same version without one
   (1.0.0-alpha < 1.0.0).
3. Pre-release identifiers compare left to right; numeric identifiers compare numerically
   (alpha.2 < alpha.10), alphanumeric ones lexically in ASCII order, and a numeric
   identifier is lower than an alphanumeric one (1.0.0-1 < 1.0.0-alpha).
4. A shorter set of pre-release identifiers is lower when all preceding ones are equal
   (1.0.0-alpha < 1.0.0-alpha.1).
5. Build metadata after `+` is ignored for precedence (1.0.0+a == 1.0.0+b).
6. Leading zeros in numeric identifiers (01.0.0, 1.0.0-01) and empty identifiers raise
   ValueError.
FAIL if any rule is violated or the file is missing.
