import { describe, expect, it } from "@effect/vitest";
import { ownChatsHref, PROFILE_SIGN, profileHref } from "@/lib/profile/href";

describe("profile href", () => {
  it("opens the address of a username with the profile sign", () => {
    expect(PROFILE_SIGN).toBe("@");
    expect(profileHref("nabilfatih")).toBe("/@nabilfatih");
    expect(profileHref(":username")).toBe("/@:username");
  });

  it("sends a person to their own chats at the chat tab of their profile", () => {
    expect(ownChatsHref("nabilfatih")).toBe("/@nabilfatih/chat");
  });

  it("sends an account that holds no username to the page of a new chat", () => {
    expect(ownChatsHref(undefined)).toBe("/chat");
  });
});
