import { describe, expect, it } from "@effect/vitest";
import { memberStatusOf } from "@repo/backend/confect/tenancy/roster";

describe("tenancy/roster status", () => {
  it("shows a claimed Person as joined, whatever still waits for it", () => {
    expect(memberStatusOf({ carded: true, claimed: true, invited: true })).toBe(
      "joined"
    );
  });

  it("shows an unclaimed Person with a pending invite as invited, before its card", () => {
    expect(
      memberStatusOf({ carded: true, claimed: false, invited: true })
    ).toBe("invited");
  });

  it("shows an unclaimed Person with only a login card as card issued", () => {
    expect(
      memberStatusOf({ carded: true, claimed: false, invited: false })
    ).toBe("cardIssued");
  });

  it("shows an unclaimed Person with neither an invite nor a card as not invited", () => {
    expect(
      memberStatusOf({ carded: false, claimed: false, invited: false })
    ).toBe("notInvited");
  });
});
