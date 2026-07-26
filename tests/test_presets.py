"""Every shipped preset must validate against the worker registry schema."""

import json
from pathlib import Path

import jsonschema
import pytest

REPO = Path(__file__).resolve().parents[1]
SCHEMA = json.loads((REPO / "workers" / "registry.schema.json").read_text(encoding="utf-8"))
PRESETS = sorted((REPO / "workers" / "presets").glob("*.json"))


def test_presets_exist():
    assert PRESETS, "no presets found under workers/presets"


@pytest.mark.parametrize("preset", PRESETS, ids=lambda p: p.name)
def test_preset_validates_against_schema(preset):
    record = json.loads(preset.read_text(encoding="utf-8"))
    jsonschema.validate(record, SCHEMA)
    assert record["id"] == preset.stem, "preset id must match its filename"
