import { describe, expect, it } from "@effect/vitest";
import {
  getTryoutDataIntentKey,
  isTryoutQueryLeaseActive,
  TRYOUT_QUERY_LEASE_MS,
} from "@/components/tryout/navigation/intent";

const attemptId = "attempt-id";

describe("try-out navigation data intent", () => {
  it("keys exact set and section subscriptions independently", () => {
    expect(getTryoutDataIntentKey({ attemptId, kind: "set" })).toBe(
      "set:attempt-id"
    );
    expect(
      getTryoutDataIntentKey({
        attemptId,
        kind: "section",
        sectionKey: "reasoning",
      })
    ).toBe("section:attempt-id:reasoning");
  });

  it("keeps one query warm only inside the try-out lease", () => {
    const now = 10_000;
    const expiresAt = now + TRYOUT_QUERY_LEASE_MS;

    expect(isTryoutQueryLeaseActive(undefined, now)).toBe(false);
    expect(isTryoutQueryLeaseActive(expiresAt, now)).toBe(true);
    expect(isTryoutQueryLeaseActive(expiresAt, expiresAt - 1)).toBe(true);
    expect(isTryoutQueryLeaseActive(expiresAt, expiresAt)).toBe(false);
  });
});
