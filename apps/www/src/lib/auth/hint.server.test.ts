// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { hintScopeFor, signedInHintCookie } from "@/lib/auth/hint";
import { readRequestSignedInHint } from "@/lib/auth/hint.server";

const mocks = vi.hoisted(() => ({
  cookie: vi.fn<() => string | null>(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () =>
    new Request("https://nakafa.com/en/try-out", {
      headers: mocks.cookie() === null ? {} : { cookie: mocks.cookie() ?? "" },
    }),
}));

const hint = signedInHintCookie(hintScopeFor(new URL("https://nakafa.com")));

describe("request signed-in hint", () => {
  it("reads the hint from the request's cookies", () => {
    mocks.cookie.mockReturnValue(`theme=dark; ${hint}`);
    expect(readRequestSignedInHint()).toBe(true);
  });

  it("reports no hint for a request without the hint cookie", () => {
    mocks.cookie.mockReturnValue("theme=dark");
    expect(readRequestSignedInHint()).toBe(false);
  });

  it("reports no hint for a request without any cookies", () => {
    mocks.cookie.mockReturnValue(null);
    expect(readRequestSignedInHint()).toBe(false);
  });
});
