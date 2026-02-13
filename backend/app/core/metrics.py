from collections import defaultdict
import threading


class InMemoryMetrics:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.total_requests = 0
        self.total_errors = 0
        self.total_duration_ms = 0.0
        self.requests_by_status: dict[str, int] = defaultdict(int)
        self.requests_by_route: dict[tuple[str, str], int] = defaultdict(int)

    def record_request(self, method: str, path: str, status_code: int, duration_ms: float) -> None:
        with self._lock:
            self.total_requests += 1
            self.total_duration_ms += duration_ms
            self.requests_by_status[str(status_code)] += 1
            self.requests_by_route[(method.upper(), path)] += 1
            if status_code >= 500:
                self.total_errors += 1

    def render_prometheus(self) -> str:
        with self._lock:
            lines = [
                "# HELP artifactory_http_requests_total Total HTTP requests",
                "# TYPE artifactory_http_requests_total counter",
                f"artifactory_http_requests_total {self.total_requests}",
                "# HELP artifactory_http_errors_total Total HTTP 5xx responses",
                "# TYPE artifactory_http_errors_total counter",
                f"artifactory_http_errors_total {self.total_errors}",
                "# HELP artifactory_http_request_duration_ms_total Total request duration in milliseconds",
                "# TYPE artifactory_http_request_duration_ms_total counter",
                f"artifactory_http_request_duration_ms_total {self.total_duration_ms:.2f}",
                "# HELP artifactory_http_requests_by_status_total Requests grouped by HTTP status",
                "# TYPE artifactory_http_requests_by_status_total counter",
            ]

            for status, count in sorted(self.requests_by_status.items()):
                lines.append(f'artifactory_http_requests_by_status_total{{status="{status}"}} {count}')

            lines.extend(
                [
                    "# HELP artifactory_http_requests_by_route_total Requests grouped by route",
                    "# TYPE artifactory_http_requests_by_route_total counter",
                ]
            )
            for (method, path), count in sorted(self.requests_by_route.items()):
                safe_path = path.replace('\\', '\\\\').replace('"', '\\"')
                lines.append(
                    f'artifactory_http_requests_by_route_total{{method="{method}",path="{safe_path}"}} {count}'
                )

        return "\n".join(lines) + "\n"

    def reset(self) -> None:
        with self._lock:
            self.total_requests = 0
            self.total_errors = 0
            self.total_duration_ms = 0.0
            self.requests_by_status.clear()
            self.requests_by_route.clear()
