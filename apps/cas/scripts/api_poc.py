"""Exercise the CAS API changes introduced by math-reasoning support."""

import argparse
import os
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol

import httpx2 as httpx
from dotenv import load_dotenv

DEFAULT_API_KEY = "cas-api-poc-key"
MATH_ENDPOINT = "/api/math"
PathPart = str | int


class ApiClient(Protocol):
    """HTTP client surface shared by httpx and FastAPI's TestClient."""

    def get(self, url: str) -> httpx.Response: ...

    def post(
        self,
        url: str,
        *,
        headers: Mapping[str, str] | None = None,
        json: object | None = None,
    ) -> httpx.Response: ...

    def close(self) -> None: ...


@dataclass(frozen=True)
class Expectation:
    """One expected value at a nested response path."""

    path: tuple[PathPart, ...]
    value: object


@dataclass(frozen=True)
class ApiCase:
    """One authenticated discrete API behavior to prove."""

    name: str
    payload: dict[str, object]
    expected_status: int
    expectations: tuple[Expectation, ...]


def success_case(
    name: str,
    payload: dict[str, object],
    *expectations: Expectation,
) -> ApiCase:
    """Create one successful API case with the shared result invariants."""
    return ApiCase(
        name=name,
        payload={"kind": "math", **payload},
        expected_status=200,
        expectations=(
            Expectation(("status",), "verified"),
            Expectation(("stepStatus",), "complete"),
            *expectations,
        ),
    )


def error_case(name: str, payload: dict[str, object], message: str) -> ApiCase:
    """Create one domain-validation case handled as HTTP 422."""
    return ApiCase(
        name=name,
        payload={"kind": "math", **payload},
        expected_status=422,
        expectations=(Expectation(("detail",), message),),
    )


DISCRETE_CASES = (
    success_case(
        "gcd uses Euclidean reasoning",
        {"operation": "gcd", "values": ["18", "24"]},
        Expectation(("secondary", "expression"), "6"),
        Expectation(
            ("steps", 0, "reason"),
            (
                "Use Euclidean division; replacing the larger number by the remainder "
                "preserves the gcd."
            ),
        ),
    ),
    success_case(
        "gcd handles two zeros",
        {"operation": "gcd", "values": ["0", "0"]},
        Expectation(("secondary", "expression"), "0"),
        Expectation(
            ("steps", 0, "reason"),
            ("The gcd of two zeros is 0 in this exact integer convention."),
        ),
    ),
    success_case(
        "gcd handles one zero",
        {"operation": "gcd", "values": ["18", "0"]},
        Expectation(("secondary", "expression"), "18"),
        Expectation(
            ("steps", 0, "reason"),
            ("The gcd of an integer and 0 is the integer's absolute value."),
        ),
    ),
    success_case(
        "multi-value gcd uses associative reasoning",
        {"operation": "gcd", "values": ["84", "30", "6"]},
        Expectation(("secondary", "expression"), "6"),
        Expectation(
            ("steps", 0, "reason"),
            ("Reduce the integer list using the associative gcd operation."),
        ),
    ),
    success_case(
        "lcm includes gcd identity evidence",
        {"operation": "lcm", "values": ["6", "8"]},
        Expectation(("secondary", "expression"), "24"),
        Expectation(("steps", 0, "items", 0, "value"), "2"),
        Expectation(("steps", 0, "items", 1, "value"), "|6*8|/gcd(6, 8)"),
    ),
    success_case(
        "lcm handles two zeros",
        {"operation": "lcm", "values": ["0", "0"]},
        Expectation(("secondary", "expression"), "0"),
        Expectation(
            ("steps", 0, "reason"),
            (
                "Both inputs are zero, so the least common multiple is 0 in this exact "
                "integer convention."
            ),
        ),
    ),
    success_case(
        "multi-value lcm uses associative reasoning",
        {"operation": "lcm", "values": ["6", "8", "12"]},
        Expectation(("secondary", "expression"), "24"),
        Expectation(
            ("steps", 0, "reason"),
            ("Reduce the integer list using the associative lcm operation."),
        ),
    ),
    success_case(
        "positive prime factorization orders factors",
        {"operation": "prime_factorization", "n": "84"},
        Expectation(("secondary", "expression"), "2^2*3*7"),
        Expectation(
            ("steps", 0, "reason"),
            (
                "Break the integer into prime factors and combine repeated primes as "
                "powers."
            ),
        ),
    ),
    success_case(
        "one uses the empty product",
        {"operation": "prime_factorization", "n": "1"},
        Expectation(("secondary", "expression"), "1"),
        Expectation(
            ("steps", 0, "reason"),
            ("1 has no prime factors, so the empty product is 1."),
        ),
    ),
    success_case(
        "negative one is the sign unit",
        {"operation": "prime_factorization", "n": "-1"},
        Expectation(("secondary", "expression"), "-1"),
        Expectation(
            ("steps", 0, "reason"),
            ("-1 is the sign unit and has no positive prime factors."),
        ),
    ),
    success_case(
        "negative factorization keeps the sign first",
        {"operation": "prime_factorization", "n": "-12"},
        Expectation(("secondary", "expression"), "-1*2^2*3"),
        Expectation(
            ("steps", 0, "reason"),
            (
                "Separate the negative sign, then combine equal positive prime factors "
                "as powers."
            ),
        ),
    ),
    success_case(
        "one is not prime by definition",
        {"operation": "is_prime", "n": "1"},
        Expectation(("steps", 0, "secondary", "expression"), "not prime"),
        Expectation(
            ("steps", 0, "reason"), ("Prime numbers are integers greater than 1.")
        ),
    ),
    success_case(
        "two is prime by its divisors",
        {"operation": "is_prime", "n": "2"},
        Expectation(("steps", 0, "secondary", "expression"), "prime"),
        Expectation(
            ("steps", 0, "reason"), ("2 has exactly two positive divisors: 1 and 2.")
        ),
    ),
    success_case(
        "larger prime lists checked divisors",
        {"operation": "is_prime", "n": "17"},
        Expectation(("steps", 0, "secondary", "expression"), "prime"),
        Expectation(("steps", 0, "items", 0, "value"), "2, 3"),
    ),
    success_case(
        "composite number includes a divisor",
        {"operation": "is_prime", "n": "21"},
        Expectation(("steps", 0, "secondary", "expression"), "not prime"),
        Expectation(("steps", 0, "items", 0, "value"), "3"),
        Expectation(("steps", 0, "reason"), "3 divides 21, so 21 is not prime."),
    ),
    success_case(
        "modular arithmetic includes division evidence",
        {"operation": "modular", "n": "84", "modulus": "30"},
        Expectation(("secondary", "expression"), "24"),
        Expectation(("steps", 0, "items", 0, "value"), "84 = 2*30 + 24"),
    ),
    success_case(
        "negative modular input preserves Euclidean remainder",
        {"operation": "modular", "n": "-17", "modulus": "5"},
        Expectation(("secondary", "expression"), "3"),
        Expectation(("steps", 0, "items", 0, "value"), "-17 = -4*5 + 3"),
    ),
    success_case(
        "combination shows formula then evaluation",
        {"operation": "combination", "n": "5", "k": "2"},
        Expectation(("secondary", "expression"), "10"),
        Expectation(("steps", 0, "secondary", "expression"), "5!/(2!*3!)"),
        Expectation(
            ("steps", 1, "reason"), ("Evaluate the factorials and simplify exactly.")
        ),
    ),
    success_case(
        "permutation shows formula then evaluation",
        {"operation": "permutation", "n": "5", "k": "2"},
        Expectation(("secondary", "expression"), "20"),
        Expectation(("steps", 0, "secondary", "expression"), "5!/3!"),
        Expectation(
            ("steps", 1, "reason"), ("Evaluate the factorials and simplify exactly.")
        ),
    ),
    error_case(
        "gcd rejects an empty value list",
        {"operation": "gcd"},
        "Discrete value operations require at least one integer.",
    ),
    error_case(
        "discrete operations reject non-integers",
        {"operation": "gcd", "values": ["3/2", "2"]},
        "Discrete operands must be integers.",
    ),
    error_case(
        "prime factorization rejects zero",
        {"operation": "prime_factorization", "n": "0"},
        "Prime factorization requires a nonzero integer.",
    ),
    error_case(
        "modular arithmetic rejects zero modulus",
        {"operation": "modular", "n": "84", "modulus": "0"},
        "Modulus must be nonzero.",
    ),
    error_case(
        "combination rejects invalid bounds",
        {"operation": "combination", "n": "3", "k": "5"},
        "Combination requires integer operands with 0 <= k <= n.",
    ),
    error_case(
        "permutation rejects invalid bounds",
        {"operation": "permutation", "n": "3", "k": "-1"},
        "Permutation requires integer operands with 0 <= k <= n.",
    ),
)


def read_path(payload: object, path: tuple[PathPart, ...]) -> object:
    """Read a nested JSON value using string keys and list indexes."""
    current = payload

    for part in path:
        if isinstance(part, str) and isinstance(current, dict):
            current = current[part]
            continue

        if isinstance(part, int) and isinstance(current, list):
            current = current[part]
            continue

        raise KeyError(f"Cannot read {part!r} from {current!r}")

    return current


def verify_response(case: ApiCase, response: httpx.Response) -> list[str]:
    """Return readable failures for one API response."""
    failures: list[str] = []

    if response.status_code != case.expected_status:
        failures.append(
            f"expected HTTP {case.expected_status}, received {response.status_code}"
        )
        return failures

    payload = response.json()

    for expectation in case.expectations:
        try:
            actual = read_path(payload, expectation.path)
        except (IndexError, KeyError) as error:
            failures.append(f"missing {expectation.path!r}: {error}")
            continue

        if actual != expectation.value:
            failures.append(
                f"{expectation.path!r}: expected {expectation.value!r}, got {actual!r}"
            )

    if response.status_code == 200:
        steps = payload.get("steps", [])
        if not steps or not all(step.get("reason") for step in steps):
            failures.append("every successful result must serialize a step reason")

    return failures


def create_client(base_url: str | None, api_key: str) -> ApiClient:
    """Create a live HTTP client or an isolated in-process FastAPI client."""
    if base_url:
        return httpx.Client(base_url=base_url, timeout=10)

    os.environ["MATH_CAS_API_KEY"] = api_key
    from fastapi.testclient import TestClient

    from api.index import app

    return TestClient(app, raise_server_exceptions=False)


def verify_shared_step_contract() -> list[str]:
    """Prove shared formatter and schema behavior with and without a reason."""
    from cas.format import step

    reason = "Evaluate the exact arithmetic expression."
    reasoned_step = step("evaluate", primary="2 + 2", secondary="4", reason=reason)
    unreasoned_step = step("evaluate", primary="2 + 2", secondary="4")
    failures: list[str] = []

    if reasoned_step.reason != reason:
        failures.append("shared step formatter did not preserve its reason")

    if reasoned_step.model_dump(exclude_none=True).get("reason") != reason:
        failures.append("MathStep schema did not serialize its reason")

    if "reason" in unreasoned_step.model_dump(exclude_none=True):
        failures.append("MathStep schema serialized an absent reason")

    return failures


def verify_api_omits_absent_reason(
    client: ApiClient, headers: Mapping[str, str]
) -> list[str]:
    """Prove unchanged CAS operations remain compatible with optional reasons."""
    response = client.post(
        MATH_ENDPOINT,
        headers=headers,
        json={
            "kind": "math",
            "operation": "evaluate",
            "expression": "2 + 2",
        },
    )

    if response.status_code != 200:
        return [f"unchanged evaluate operation returned HTTP {response.status_code}"]

    payload = response.json()
    if payload["secondary"]["expression"] != "4":
        return ["unchanged evaluate operation returned the wrong result"]

    if "reason" in payload["steps"][0]:
        return ["API serialized a null reason instead of omitting it"]

    return []


def parse_args() -> argparse.Namespace:
    """Parse optional live-server proof settings."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        help="Run against a live CAS server, for example http://localhost:3003.",
    )
    parser.add_argument(
        "--api-key",
        help="Bearer token for a live server; defaults to MATH_CAS_API_KEY.",
    )
    return parser.parse_args()


def main() -> int:
    """Run shared contract, health, auth, and discrete reasoning proof cases."""
    args = parse_args()
    load_dotenv(".env.local", override=False)
    configured_api_key = args.api_key or os.environ.get("MATH_CAS_API_KEY")

    if args.base_url and not configured_api_key:
        print(
            "FAIL  MATH_CAS_API_KEY is missing. Configure apps/cas/.env.local "
            "or pass --api-key."
        )
        return 2

    api_key = configured_api_key or DEFAULT_API_KEY
    client = create_client(args.base_url, api_key)
    failures: list[str] = []

    try:
        shared_failures = verify_shared_step_contract()
        if shared_failures:
            failures.extend(shared_failures)
            print("FAIL  shared MathStep reason contract")
        else:
            print("PASS  shared MathStep reason contract")

        health = client.get("/health")
        if health.status_code == 200 and health.json() == {"status": "ok"}:
            print("PASS  health check")
        else:
            failures.append(f"health check: HTTP {health.status_code} {health.text}")

        auth_cases = (
            ("missing bearer token", None),
            ("incorrect bearer token", "incorrect-key"),
        )
        for name, token in auth_cases:
            headers = {} if token is None else {"Authorization": f"Bearer {token}"}
            response = client.post(
                MATH_ENDPOINT,
                headers=headers,
                json={"kind": "math", "operation": "is_prime", "n": "17"},
            )
            if response.status_code == 401:
                print(f"PASS  {name}")
            else:
                failures.append(
                    f"{name}: expected HTTP 401, got {response.status_code}"
                )

        headers = {"Authorization": f"Bearer {api_key}"}
        compatibility_failures = verify_api_omits_absent_reason(client, headers)
        if compatibility_failures:
            failures.extend(compatibility_failures)
            print("FAIL  unchanged API step omits absent reason")
        else:
            print("PASS  unchanged API step omits absent reason")

        for case in DISCRETE_CASES:
            response = client.post(MATH_ENDPOINT, headers=headers, json=case.payload)
            if response.status_code == 401:
                failures.append(
                    "live CAS rejected MATH_CAS_API_KEY; restart the server and "
                    "proof with the same configured value"
                )
                print("FAIL  authenticated CAS request")
                break

            case_failures = verify_response(case, response)
            if case_failures:
                failures.extend(f"{case.name}: {failure}" for failure in case_failures)
                print(f"FAIL  {case.name}")
            else:
                print(f"PASS  {case.name}")
    except httpx.RequestError:
        print(
            f"FAIL  Could not reach the live CAS server at {args.base_url}.\n"
            "Start it in another apps/cas terminal with `pnpm dev`, or omit "
            "--base-url to run the in-process proof."
        )
        return 2
    finally:
        client.close()

    if failures:
        print(f"\n{len(failures)} proof failure(s):")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print(f"\nPASS  {len(DISCRETE_CASES) + 5} CAS API proof cases")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
