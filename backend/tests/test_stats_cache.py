from app.services.stats_service import StatsService


def test_stats_cache_invalidates_after_write(client) -> None:
    # Initial read to prime cache
    first = client.get("/api/v1/stats")
    assert first.status_code == 200
    assert first.json()["total_kits"] == 0

    # Write changes snapshot
    create = client.post(
        "/api/v1/kits",
        json={
            "name": "Cache Test Kit",
            "grade": "HG",
            "series": "UC",
            "brand": "Bandai",
            "scale": "1/144",
            "build_status": "NEW",
            "tag_ids": [],
        },
    )
    assert create.status_code == 201

    # Read again should reflect new state (cache invalidated by snapshot change)
    second = client.get("/api/v1/stats")
    assert second.status_code == 200
    assert second.json()["total_kits"] == 1


def test_stats_service_cache_reset() -> None:
    # Smoke-test explicit cache reset utility used by tests.
    StatsService.reset_cache()
