// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { readRedirectResponse } from "@/lib/routing/redirect";
import { routeRewrite } from "@/lib/routing/rewrite";

const address = (path: string) => new URL(`https://nakafa.com${path}`);
const schoolAddress = (path: string) =>
  new URL(`https://harapan.nakafa.com${path}`);

describe("routeRewrite", () => {
  it("maps a profile address to the router's path and the address back", () => {
    const router = routeRewrite.input({
      url: address("/en/@nabilfatih/chat"),
    });

    expect(router.pathname).toBe("/en/user/nabilfatih/chat");
    expect(routeRewrite.output({ url: router }).pathname).toBe(
      "/en/@nabilfatih/chat"
    );
  });

  it("keeps the settings page and a localized path on the router's own spelling", () => {
    expect(
      routeRewrite.input({ url: address("/en/user/settings") }).pathname
    ).toBe("/en/user/settings");
    expect(
      routeRewrite.output({ url: address("/en/user/settings/memory") }).pathname
    ).toBe("/en/user/settings/memory");
  });

  it("maps the root of a school host to the school home, with no locale redirect", () => {
    expect(
      Option.isNone(
        readRedirectResponse(new Request("https://harapan.nakafa.com/"))
      )
    ).toBe(true);
    expect(routeRewrite.input({ url: schoolAddress("/") }).pathname).toBe(
      "/school/harapan"
    );
  });

  it("maps the school tree back to the school host", () => {
    const address = routeRewrite.output({
      url: schoolAddress("/school/harapan/exams"),
    });

    expect(address.hostname).toBe("harapan.nakafa.com");
    expect(address.pathname).toBe("/exams");
  });
});
