import { describe, expect, it } from "@effect/vitest";
import { cardOffered } from "@/components/tenant/settings/offer";

describe("components/tenant/settings/offer", () => {
  it("offers a login card to a teacher or a student, and to no Owner or Admin", () => {
    expect([
      cardOffered(["teacher"]),
      cardOffered(["student"]),
      cardOffered([]),
      cardOffered(["admin"]),
      cardOffered(["teacher", "owner"]),
    ]).toEqual([true, true, true, false, false]);
  });
});
