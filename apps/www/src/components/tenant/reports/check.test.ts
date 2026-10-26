import { describe, expect, it } from "@effect/vitest";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { checkAddress } from "@/components/tenant/reports/check";

describe("checkAddress", () => {
  it("opens a locked report's check page on the main site in the viewer's language", () => {
    expect(checkAddress("id", "9f86d081")).toBe(
      `${SITE_ORIGIN}/id/verify/9f86d081`
    );
  });
});
