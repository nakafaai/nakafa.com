import { describe, expect, it } from "@effect/vitest";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { NotMember } from "@repo/backend/confect/middleware/member.spec";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";

describe("isLostAccess", () => {
  it("names a viewer who is no longer a member of the school", () => {
    expect(isLostAccess(new NotMember())).toBe(true);
  });

  it("names a viewer who lost the role that the page needs", () => {
    expect(
      isLostAccess(new AccessDenied({ action: "exam.rooms", reason: "role" }))
    ).toBe(true);
  });

  it("leaves a refusal of one item to the page that shows it", () => {
    expect(
      isLostAccess(
        new AccessDenied({ action: "exam.rooms", reason: "resource" })
      )
    ).toBe(false);
  });

  it("leaves every other failure to its own part of the page", () => {
    expect(isLostAccess(new Error("offline"))).toBe(false);
    expect(isLostAccess(undefined)).toBe(false);
  });
});

describe("isDenied", () => {
  it("names a refusal of any item, whatever its reason", () => {
    expect(
      isDenied(new AccessDenied({ action: "exam.rooms", reason: "resource" }))
    ).toBe(true);
  });

  it("does not name a failure that is not a refusal", () => {
    expect(isDenied(new NotMember())).toBe(false);
  });
});
