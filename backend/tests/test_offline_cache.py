import json
from pathlib import Path

def test_offline_cache_is_demo_metadata():
    cache = json.loads((Path(__file__).parents[1] / "data" / "offline_cache.json").read_text())
    assert [record["suspect_id"] for record in cache] == ["S001", "S002", "S003"]
