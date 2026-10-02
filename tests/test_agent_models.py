"""Every role file must pin its model by alias, never by a dated model ID."""

from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
AGENTS = sorted((REPO / "agents").glob("*.md"))
ALIASES = {"opus", "sonnet", "haiku", "fable", "inherit"}


def frontmatter(path):
    """Top-level `key: value` pairs of the leading `---` block; no YAML dependency needed."""
    lines = path.read_text(encoding="utf-8").splitlines()
    assert lines and lines[0].strip() == "---", f"{path.name}: no frontmatter"
    fields = {}
    for line in lines[1:]:
        if line.strip() == "---":
            return fields
        if line[:1].isspace() or ":" not in line:
            continue
        key, value = line.split(":", 1)
        fields[key.strip()] = value.strip().strip("'\"")
    raise AssertionError(f"{path.name}: frontmatter is not closed")


def test_role_files_exist():
    assert AGENTS, "no role files found under agents/"


@pytest.mark.parametrize("agent", AGENTS, ids=lambda p: p.name)
def test_model_is_an_alias(agent):
    model = frontmatter(agent).get("model")
    assert model in ALIASES, f"{agent.name}: model {model!r} is not one of {sorted(ALIASES)}"
