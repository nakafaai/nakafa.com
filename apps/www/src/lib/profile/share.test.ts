import { describe, expect, it } from "@effect/vitest";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { isShareCancel, profileUrl } from "@/lib/profile/share";

describe("profile share", () => {
  it("builds the absolute address of a profile in its locale", () => {
    expect(profileUrl("id", "nabilfatih")).toBe(
      `${SITE_ORIGIN}/id/@nabilfatih`
    );
  });

  it("treats a closed share sheet as no failure", () => {
    expect(
      isShareCancel(new DOMException("The share was canceled.", "AbortError"))
    ).toBe(true);
  });

  it("reports every other share failure", () => {
    expect(
      isShareCancel(
        new DOMException("Sharing is not allowed.", "NotAllowedError")
      )
    ).toBe(false);
    expect(isShareCancel(new Error("The share failed."))).toBe(false);
    expect(isShareCancel(undefined)).toBe(false);
  });
});
