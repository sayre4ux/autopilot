"""The eval-only haiku-high engineer must stay a copy of agents/engineer.md."""

from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "agents" / "engineer.md"
COPY = (
    REPO / "evals" / "model" / "engineer-gitignore-haiku-high"
    / "eval-plugin" / "agents" / "engineer-haiku-high.md"
)
SWAPS = {
    "name: engineer": "name: engineer-haiku-high",
    "model: opus": "model: haiku",
    "effort: medium": "effort: high",
}


def test_haiku_high_copy_matches_engineer():
    expected = [SWAPS.get(line, line) for line in SOURCE.read_text(encoding="utf-8").splitlines()]
    actual = COPY.read_text(encoding="utf-8").splitlines()
    assert actual == expected, (
        "eval-plugin/agents/engineer-haiku-high.md drifted from agents/engineer.md; regenerate it "
        "with the name/model/effort swaps only"
    )
