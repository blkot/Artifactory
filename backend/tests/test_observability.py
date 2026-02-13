
def test_request_id_header_is_echoed(client) -> None:
    request_id = "req-observe-001"
    response = client.get("/health", headers={"X-Request-ID": request_id})
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == request_id


def test_metrics_endpoint_exposes_counters(client) -> None:
    # Generate some traffic
    client.get("/health")
    client.get("/api/v1/tags")

    metrics = client.get("/metrics")
    assert metrics.status_code == 200
    body = metrics.text
    assert "artifactory_http_requests_total" in body
    assert 'artifactory_http_requests_by_route_total{method="GET",path="/health"}' in body
    assert 'artifactory_http_requests_by_route_total{method="GET",path="/api/v1/tags"}' in body
