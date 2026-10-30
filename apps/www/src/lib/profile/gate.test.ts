// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { isRawProfileAddress } from "@/lib/profile/gate";

const request = (path: string) => new Request(`https://nakafa.com${path}`);

describe("isRawProfileAddress", () => {
  it("names a raw user address, its tab and its Markdown spelling", () => {
    for (const path of [
      "/en/user/nabilfatih",
      "/id/user/nabilfatih/chat",
      "/en/user/k57abc.md",
    ]) {
      expect(isRawProfileAddress(request(path)), path).toBe(true);
    }
  });

  it("leaves the settings page, the profile address and every other path to the router", () => {
    for (const path of [
      "/en/user/settings",
      "/en/user/settings/memory",
      "/en/@nabilfatih",
      "/en/user",
      "/en",
      "/",
      "/xx/user/nabilfatih",
      "/en/articles/nabilfatih",
    ]) {
      expect(isRawProfileAddress(request(path)), path).toBe(false);
    }
  });
});
