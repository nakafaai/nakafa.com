// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option, Result } from "effect";
import {
  createWwwHeaders,
  renderHeadersFile,
  type WwwHeader,
  WwwHeaderLineTooLong,
} from "@/lib/security/headers";

const production = {
  convexSiteUrl: "https://example.convex.site",
  convexUrl: "https://example.convex.cloud",
  posthogProxyHost: "https://t.nakafa.com",
};

/** Matches the loopback image origin that a local Convex deployment adds to img-src. */
const LOOPBACK_IMAGE_SOURCE = /img-src [^;]*http:\/\/127\.0\.0\.1:3210/;

/** Reads one header of the list by its name. */
function headerValue(headers: readonly WwwHeader[], key: string) {
  return Option.getOrUndefined(
    Arr.findFirst(headers, (header) => header.key === key)
  )?.value;
}

describe("createWwwHeaders", () => {
  it("names the PostHog proxy host and no loopback origin in production", () => {
    const headers = createWwwHeaders(production);
    const policy = headerValue(headers, "Content-Security-Policy") ?? "";

    expect(policy).toContain("https://t.nakafa.com");
    expect(policy).not.toContain("127.0.0.1");
    expect(headerValue(headers, "X-Frame-Options")).toBe("DENY");
    expect(headerValue(headers, "X-Llms-Txt")).toBe("/llms.txt");
  });

  it("names the loopback Convex origins of a local deployment in the policy", () => {
    const headers = createWwwHeaders({
      convexSiteUrl: "http://127.0.0.1:3211",
      convexUrl: "http://127.0.0.1:3210",
      posthogProxyHost: "https://t.nakafa.com",
    });
    const policy = headerValue(headers, "Content-Security-Policy") ?? "";

    expect(policy).toContain("connect-src");
    expect(policy).toContain("http://127.0.0.1:3210");
    expect(policy).toContain("ws://127.0.0.1:3210");
    expect(policy).toContain("http://127.0.0.1:3211");
    expect(policy).toMatch(LOOPBACK_IMAGE_SOURCE);
  });

  it("omits an unset Convex deployment URL", () => {
    const headers = createWwwHeaders({ ...production, convexUrl: undefined });

    expect(headerValue(headers, "Content-Security-Policy")).not.toContain(
      "127.0.0.1"
    );
  });
});

describe("renderHeadersFile", () => {
  it("writes one rule for every path with each header indented beneath it", () => {
    const file = renderHeadersFile([
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Link", value: '</llms.txt>; rel="llms-txt"' },
    ]);

    expect(file).toStrictEqual(
      Result.succeed(
        '/*\n  X-Frame-Options: DENY\n  Link: </llms.txt>; rel="llms-txt"\n'
      )
    );
  });

  it("fails rather than write a line over the static asset limit", () => {
    const failed = renderHeadersFile([
      { key: "X-Long", value: "a".repeat(2000) },
    ]);

    expect(Result.isFailure(failed)).toBe(true);
    expect(Result.isFailure(failed) && failed.failure).toBeInstanceOf(
      WwwHeaderLineTooLong
    );
  });
});
