import { QueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import { readAccountConsentQuery } from "@/lib/analytics/consent/account";

describe("account consent query", () => {
  it("names the account's answer once it arrives, with no decision yet", () => {
    expect(
      readAccountConsentQuery(QueryResult.succeed({ decision: null }))
    ).toStrictEqual({ decision: null, status: "success" });
  });

  it("names a failed account query as a failure", () => {
    expect(
      readAccountConsentQuery(QueryResult.fail("unavailable"))
    ).toStrictEqual({
      status: "failure",
    });
  });

  it("keeps a query that has not answered pending", () => {
    expect(readAccountConsentQuery(QueryResult.load(false))).toStrictEqual({
      status: "pending",
    });
  });

  it("keeps a skipped query pending, so no account is named before it runs", () => {
    expect(readAccountConsentQuery(QueryResult.load(true))).toStrictEqual({
      status: "pending",
    });
  });
});
