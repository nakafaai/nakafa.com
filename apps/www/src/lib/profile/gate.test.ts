// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { readProfileGate } from "@/lib/profile/gate";

const request = (path: string) => new Request(`https://nakafa.com${path}`);

describe("readProfileGate", () => {
  it("answers a raw user address with the not-found locale of its own address", () => {
    expect(
      Option.getOrThrow(readProfileGate(request("/en/user/nabilfatih")))
    ).toBe("en");
  });

  it("answers the raw user address of a tab too, in its own locale", () => {
    expect(
      Option.getOrThrow(readProfileGate(request("/id/user/nabilfatih/chat")))
    ).toBe("id");
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
      expect(Option.isNone(readProfileGate(request(path))), path).toBe(true);
    }
  });
});
