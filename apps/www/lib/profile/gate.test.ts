// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { answerProfileGate } from "@/lib/profile/gate";

const request = (path: string) => new Request(`https://nakafa.com${path}`);

describe("answerProfileGate", () => {
  it("answers a raw user address with a not-found page that no index keeps", () => {
    const answer = Option.getOrThrow(
      answerProfileGate(request("/en/user/nabilfatih"))
    );

    expect(answer.status).toBe(404);
    expect(answer.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("answers the raw user address of a tab too", () => {
    expect(
      Option.getOrThrow(answerProfileGate(request("/id/user/nabilfatih/chat")))
        .status
    ).toBe(404);
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
      expect(Option.isNone(answerProfileGate(request(path))), path).toBe(true);
    }
  });
});
