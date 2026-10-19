// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import {
  expiredHintCookie,
  hintCookieFor,
  SIGNED_IN_ATTRIBUTE,
  signedInHintCookie,
  signedInHintScript,
} from "@/lib/auth/hint";
import { ClientSession } from "@/lib/auth/visitor";

describe("sign-in hint cookie", () => {
  it("is readable by the page and lasts the session lifetime", () => {
    expect(signedInHintCookie(false)).toBe(
      "nakafa-signed-in=1; Path=/; SameSite=Lax; Max-Age=604800"
    );
  });

  it("is secure on an https site", () => {
    expect(signedInHintCookie(true)).toBe(
      "nakafa-signed-in=1; Path=/; SameSite=Lax; Secure; Max-Age=604800"
    );
  });

  it("is cleared when the session ends", () => {
    expect(expiredHintCookie(true)).toBe(
      "nakafa-signed-in=; Path=/; SameSite=Lax; Secure; Max-Age=0"
    );
  });

  it("follows the visitor's session", () => {
    const signedIn = ClientSession.cases.SignedIn.make({
      name: "Ada",
      sessionId: "session-1",
      userId: "user-1",
    });
    expect(hintCookieFor(signedIn, false)).toBe(signedInHintCookie(false));
    expect(hintCookieFor(ClientSession.cases.SignedOut.make({}), false)).toBe(
      expiredHintCookie(false)
    );
  });
});

describe("sign-in hint script", () => {
  /** Runs the script in a stub browser and returns the attribute that it sets. */
  const run = (cookie: string) => {
    const attributes: Record<string, string> = {};
    const documentStub = {
      cookie,
      documentElement: {
        setAttribute: (name: string, value: string) => {
          attributes[name] = value;
        },
      },
    };
    new Function("document", signedInHintScript())(documentStub);
    return attributes[SIGNED_IN_ATTRIBUTE];
  };

  it("marks a page for a visitor with the hint cookie", () => {
    expect(run("a=1; nakafa-signed-in=1")).toBe("yes");
  });

  it("marks a page for a visitor without the hint", () => {
    expect(run("a=1")).toBe("no");
    expect(run("nakafa-signed-in=0")).toBe("no");
  });
});
