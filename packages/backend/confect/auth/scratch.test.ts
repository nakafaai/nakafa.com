import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { encodeJsonText } from "@repo/utilities/json";
import { symmetricDecrypt } from "better-auth/crypto";
import { Array as Arr, pipe } from "effect";

const NOW = Date.UTC(2026, 8, 4, 10, 30, 0);
const SECRET = "synthetic-better-auth-secret-for-lifecycle-tests";
const BASE64_PADDING_PATTERN = /[=]+$/;
function part(value: object) {
  return btoa(encodeJsonText(value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(BASE64_PADDING_PATTERN, "");
}
function idToken(suffix: string) {
  const issuedAt = Math.floor(NOW / 1000);
  return Arr.join(
    [
      part({ alg: "none", typ: "JWT" }),
      part({
        aud: "test-google-client",
        email: `${suffix}@example.com`,
        email_verified: true,
        exp: issuedAt + 3600,
        iat: issuedAt,
        iss: "https://accounts.google.com",
        name: `Synthetic ${suffix}`,
        picture: `https://example.com/${suffix}.png`,
        sub: `google-${suffix}`,
      }),
      "test-signature",
    ],
    "."
  );
}
async function signIn(
  test: ReturnType<typeof createConvexTestWithBetterAuth>,
  suffix: string
) {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(() =>
      Promise.resolve(
        Response.json({
          access_token: `access-${suffix}`,
          expires_in: 3600,
          id_token: idToken(suffix),
          refresh_token: `refresh-${suffix}`,
          scope: "openid email profile",
          token_type: "Bearer",
        })
      )
    )
  );
  const start = await test.fetch("/api/auth/sign-in/social", {
    body: encodeJsonText({ callbackURL: "/en", provider: "google" }),
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    method: "POST",
  });
  const state = new URL(start.headers.get("location") ?? "").searchParams.get(
    "state"
  );
  const cookie = pipe(
    start.headers.getSetCookie(),
    Arr.map((value) => value.split(";", 1)[0]),
    Arr.join("; ")
  );
  return await test.fetch(
    `/api/auth/callback/google?${new URLSearchParams({
      code: "synthetic-authorization-code",
      state: state ?? "",
    })}`,
    { headers: { cookie } }
  );
}
async function accounts(test: ReturnType<typeof createConvexTestWithBetterAuth>) {
  return await test.query((ctx) =>
    ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "account",
      paginationOpts: { cursor: null, numItems: 10 },
    })
  );
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
  vi.stubEnv("AUTH_GOOGLE_ID", "test-google-client");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "test-google-secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function cookieOf(response: Response) {
  return pipe(
    response.headers.getSetCookie(),
    Arr.map((value) => value.split(";", 1)[0]),
    Arr.join("; ")
  );
}
describe("scratch", () => {
  it("looks at legacy plain rows, junk rows and the signing key", async () => {
    const test = createConvexTestWithBetterAuth();
    const out: Record<string, unknown> = {};
    const first = await signIn(test, "legacy");
    const firstCookie = cookieOf(first);
    const [row] = (await accounts(test)).page;
    const overwrite = (accessToken: string, refreshToken: string) =>
      test.mutation((ctx) =>
        ctx.runMutation(components.betterAuth.adapter.updateOne, {
          input: {
            model: "account",
            update: { accessToken, refreshToken },
            where: [{ field: "_id", operator: "eq", value: row._id }],
          },
        })
      );
    // legacy plain row
    await overwrite("plain-access", "plain-refresh");
    const token = await test.fetch("/api/auth/get-access-token", {
      body: encodeJsonText({ providerId: "google" }),
      headers: { "content-type": "application/json", cookie: firstCookie, origin: "http://localhost:3000" },
      method: "POST",
    });
    out.plainGetAccessToken = [token.status, (await token.text()).slice(0, 80)];
    const again = await signIn(test, "legacy");
    out.plainSignInAgain = [again.status, again.headers.get("location")];
    out.afterSignIn = (await accounts(test)).page.map((r: { accessToken: string; refreshToken: string }) => [r.accessToken.slice(0, 12), r.refreshToken.slice(0, 12)]);
    // junk that looks encrypted
    await overwrite("deadbeef", "deadbeef");
    const session = await test.fetch("/api/auth/get-session", {
      headers: { cookie: firstCookie, origin: "http://localhost:3000" },
    });
    out.junkGetSession = [session.status, (await session.text()).slice(0, 60)];
    const junkAgain = await signIn(test, "legacy");
    out.junkSignInAgain = [junkAgain.status, junkAgain.headers.get("location")];
    out.afterJunkSignIn = (await accounts(test)).page.map((r: { accessToken: string }) => r.accessToken.slice(0, 12));
    await overwrite("deadbeef", "deadbeef");
    const junkToken = await test.fetch("/api/auth/get-access-token", {
      body: encodeJsonText({ providerId: "google" }),
      headers: { "content-type": "application/json", cookie: firstCookie, origin: "http://localhost:3000" },
      method: "POST",
    });
    out.junkGetAccessToken = [junkToken.status, (await junkToken.text()).slice(0, 120)];
    // signing key
    const keys = await test.query((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: "jwks",
        paginationOpts: { cursor: null, numItems: 10 },
      })
    );
    const key = keys.page[0];
    out.jwks = { count: keys.page.length, privateKeyHead: key.privateKey.slice(0, 40), publicKeyHead: key.publicKey.slice(0, 40), alg: key.alg };
    const inner = JSON.parse(key.privateKey);
    const decrypted = await symmetricDecrypt({ key: SECRET, data: inner });
    out.jwksDecryptedHead = decrypted.slice(0, 30);
    expect(out).toBe("print");
  });
});
