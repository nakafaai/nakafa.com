import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { personClaim, turnClaim } from "@repo/backend/confect/spend/schema";
import { Schema } from "effect";

const userId = Schema.decodeUnknownSync(Id("users"))("user");
const tenantId = Schema.decodeUnknownSync(Id("tenants"))("school");

describe("spend/schema claims", () => {
  it("claims a turn for its school when its credits came from the school's pool", () => {
    expect(turnClaim({ userId })).toEqual({ kind: "learner", userId });
    expect(
      turnClaim({
        pool: { day: "2026-11-07", month: "2026-11", tenantId },
        userId,
      })
    ).toEqual({ kind: "member", tenantId, userId });
  });

  it("claims a person's work for them in their school, or for the school alone when no account holds them", () => {
    expect(
      personClaim(
        {
          account: { claimedAt: 0, method: "card", state: "claimed", userId },
        },
        tenantId
      )
    ).toEqual({ kind: "member", tenantId, userId });
    expect(personClaim({ account: { state: "unclaimed" } }, tenantId)).toEqual({
      kind: "school",
      tenantId,
    });
  });
});
