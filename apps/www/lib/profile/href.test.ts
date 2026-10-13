import { describe, expect, it } from "@effect/vitest";
import { PROFILE_SIGN, profileHref } from "@/lib/profile/href";

describe("profile href", () => {
  it("opens the address of a username with the profile sign", () => {
    expect(PROFILE_SIGN).toBe("@");
    expect(profileHref("nabilfatih")).toBe("/@nabilfatih");
    expect(profileHref(":username")).toBe("/@:username");
  });
});
