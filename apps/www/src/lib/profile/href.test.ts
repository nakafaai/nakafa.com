import { describe, expect, it } from "@effect/vitest";
import {
  ownChatsTarget,
  PROFILE_SIGN,
  profileHref,
  profileTabTarget,
  profileTarget,
} from "@/lib/profile/href";

describe("profile href", () => {
  it("opens the public address of a username with the profile sign", () => {
    expect(PROFILE_SIGN).toBe("@");
    expect(profileHref("nabilfatih")).toBe("/@nabilfatih");
    expect(profileHref(":username")).toBe("/@:username");
  });

  it("routes a profile and its tabs to the router's profile segment", () => {
    expect(profileTarget("nabilfatih")).toEqual({
      from: "/$locale",
      params: { username: "nabilfatih" },
      to: "/$locale/user/$username",
    });
    expect(profileTabTarget("comments", "nabilfatih")).toEqual({
      from: "/$locale",
      params: { username: "nabilfatih" },
      to: "/$locale/user/$username/comments",
    });
  });

  it("sends a person to their own chats at the chat tab of their profile", () => {
    expect(ownChatsTarget("nabilfatih")).toEqual({
      from: "/$locale",
      params: { username: "nabilfatih" },
      to: "/$locale/user/$username/chat",
    });
  });

  it("sends an account that holds no username to the page of a new chat", () => {
    expect(ownChatsTarget(undefined)).toEqual({
      from: "/$locale",
      to: "/$locale/chat",
    });
  });
});
