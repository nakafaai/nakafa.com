// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { profileRewrite } from "@/lib/profile/rewrite";

const address = (path: string) => new URL(`https://nakafa.com${path}`);

describe("profileRewrite input", () => {
  it("maps a profile address to the router's profile path, with its query", () => {
    const url = profileRewrite.input({
      url: address("/en/@nabilfatih?page=2"),
    });

    expect(url.pathname).toBe("/en/user/nabilfatih");
    expect(url.search).toBe("?page=2");
  });

  it("keeps the tab of a profile after the username", () => {
    expect(
      profileRewrite.input({ url: address("/id/@nabilfatih/comments") })
        .pathname
    ).toBe("/id/user/nabilfatih/comments");
    expect(
      profileRewrite.input({ url: address("/de/@nabilfatih/chat") }).pathname
    ).toBe("/de/user/nabilfatih/chat");
  });

  it("keeps every path that names no profile", () => {
    for (const path of [
      "/en/@nabilfatih/posts",
      "/en/@nabilfatih/chat/extra",
      "/en/@",
      "/en",
      "/",
      "/xx/@nabilfatih",
      "/en/user/nabilfatih",
    ]) {
      expect(profileRewrite.input({ url: address(path) }).pathname, path).toBe(
        path
      );
    }
  });
});

describe("profileRewrite output", () => {
  it("maps the router's profile path back to the profile address", () => {
    expect(
      profileRewrite.output({ url: address("/en/user/nabilfatih") }).pathname
    ).toBe("/en/@nabilfatih");
  });

  it("keeps the tab of the router's profile path", () => {
    expect(
      profileRewrite.output({ url: address("/en/user/nabilfatih/comments") })
        .pathname
    ).toBe("/en/@nabilfatih/comments");
    expect(
      profileRewrite.output({ url: address("/en/user/nabilfatih/chat") })
        .pathname
    ).toBe("/en/@nabilfatih/chat");
  });

  it("keeps the settings page and every path that names no profile", () => {
    for (const path of [
      "/en/user/settings",
      "/en/user/settings/memory",
      "/en/user",
      "/en",
      "/",
      "/en/user/nabilfatih/posts",
      "/xx/user/nabilfatih",
      "/en/articles/nabilfatih",
    ]) {
      expect(profileRewrite.output({ url: address(path) }).pathname, path).toBe(
        path
      );
    }
  });

  it("answers the input's address again, so both directions agree", () => {
    for (const path of ["/en/@nabilfatih", "/id/@nabilfatih/chat"]) {
      const router = profileRewrite.input({ url: address(path) });
      expect(profileRewrite.output({ url: router }).pathname).toBe(path);
    }
  });
});
