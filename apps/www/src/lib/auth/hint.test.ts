// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import {
  expiredHintCookie,
  followSignedInHint,
  hasSignedInHint,
  hintCookieFor,
  hintScopeFor,
  isHintCurrent,
  SIGNED_IN_ATTRIBUTE,
  signedInHintCookie,
  signedInHintScript,
} from "@/lib/auth/hint";
import { ClientSession } from "@/lib/auth/visitor";

const plain = { domain: "nakafa.com", secure: false } as const;
const secure = { domain: "nakafa.com", secure: true } as const;

describe("sign-in hint cookie", () => {
  it("is readable by the page and lasts the session lifetime", () => {
    expect(signedInHintCookie(plain)).toBe(
      "nakafa-signed-in=1; Domain=nakafa.com; Path=/; SameSite=Lax; Max-Age=604800"
    );
  });

  it("is secure on an https site", () => {
    expect(signedInHintCookie(secure)).toBe(
      "nakafa-signed-in=1; Domain=nakafa.com; Path=/; SameSite=Lax; Secure; Max-Age=604800"
    );
  });

  it("shares the domain of the session cookie with every school host", () => {
    expect(signedInHintCookie({ domain: "localhost", secure: false })).toBe(
      "nakafa-signed-in=1; Domain=localhost; Path=/; SameSite=Lax; Max-Age=604800"
    );
  });

  it("is cleared on the same domain when the session ends", () => {
    expect(expiredHintCookie(secure)).toBe(
      "nakafa-signed-in=; Domain=nakafa.com; Path=/; SameSite=Lax; Secure; Max-Age=0"
    );
  });

  it("follows the visitor's session", () => {
    const signedIn = ClientSession.cases.SignedIn.make({
      name: "Ada",
      sessionId: "session-1",
      userId: "user-1",
    });
    expect(hintCookieFor(signedIn, plain)).toBe(signedInHintCookie(plain));
    expect(hintCookieFor(ClientSession.cases.SignedOut.make({}), plain)).toBe(
      expiredHintCookie(plain)
    );
  });
});

describe("sign-in hint scope", () => {
  it("names the site's host, and https only for a secure site", () => {
    expect(hintScopeFor(new URL("https://nakafa.com"))).toStrictEqual(secure);
    expect(hintScopeFor(new URL("http://localhost:3000"))).toStrictEqual({
      domain: "localhost",
      secure: false,
    });
  });
});

describe("sign-in hint currency", () => {
  const signedIn = ClientSession.cases.SignedIn.make({
    name: "Ada",
    sessionId: "session-1",
    userId: "user-1",
  });
  const visitor = ClientSession.cases.SignedOut.make({});
  const headers = (cookie?: string) =>
    new Headers(cookie === undefined ? {} : { cookie });

  it("is current for a visitor without the hint, and for a learner with it", () => {
    expect(isHintCurrent(visitor, headers())).toBe(true);
    expect(isHintCurrent(visitor, headers("theme=dark"))).toBe(true);
    expect(
      isHintCurrent(signedIn, headers("theme=dark; nakafa-signed-in=1"))
    ).toBe(true);
  });

  it("is out of date when the hint and the session disagree", () => {
    expect(isHintCurrent(signedIn, headers())).toBe(false);
    expect(isHintCurrent(signedIn, headers("nakafa-signed-in=0"))).toBe(false);
    expect(isHintCurrent(visitor, headers("nakafa-signed-in=1"))).toBe(false);
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

describe("hasSignedInHint", () => {
  it("reads the signed-in pair among the other cookies", () => {
    expect(hasSignedInHint("theme=dark; nakafa-signed-in=1")).toBe(true);
    expect(hasSignedInHint("nakafa-signed-in=1")).toBe(true);
  });

  it("ignores a cleared hint and a cookie that only names it", () => {
    expect(hasSignedInHint("nakafa-signed-in=0")).toBe(false);
    expect(hasSignedInHint("nakafa-signed-in=")).toBe(false);
    expect(hasSignedInHint("")).toBe(false);
  });
});

describe("followSignedInHint", () => {
  /** Follows the cookie onto a stub root and returns the attribute that it sets. */
  const follow = (cookie: string) => {
    const attributes: Record<string, string> = {};
    followSignedInHint(
      {
        setAttribute: (name: string, value: string) => {
          attributes[name] = value;
        },
      },
      cookie
    );
    return attributes[SIGNED_IN_ATTRIBUTE];
  };

  it("marks the root while the hint cookie says a session may exist", () => {
    expect(follow("theme=dark; nakafa-signed-in=1")).toBe("yes");
  });

  it("clears the mark once an answer has cleared the hint cookie", () => {
    expect(follow("theme=dark")).toBe("no");
  });
});
