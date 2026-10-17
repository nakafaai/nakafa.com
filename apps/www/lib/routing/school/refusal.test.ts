// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import {
  AccountUnavailable,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import { NotMember } from "@repo/backend/confect/middleware/member.spec";
import { TenantNotFound } from "@repo/backend/confect/tenancy/errors";
import {
  Array as Arr,
  Cause,
  Data,
  Effect,
  Layer,
  Logger,
  MutableList,
  Option,
} from "effect";
import { NextRequest } from "next/server";
import { clientEnv } from "@/env.client";
import { SessionTokenUnavailable } from "@/lib/auth/token";
import {
  readSchoolRefusal,
  routeSchoolPage,
} from "@/lib/routing/school/refusal";
import { proxy } from "@/proxy";

const mocks = vi.hoisted(() => ({
  layerOptions: vi.fn(),
  query: vi.fn(),
  token: vi.fn(),
}));
/** A school page reads no server value, so the server environment is a stand-in here. */
vi.mock("@/env", () => ({ env: {} }));
vi.mock("@/lib/auth/token", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/token")>()),
  readSessionToken: mocks.token,
}));
vi.mock("@confect/js", async (importOriginal) => {
  const confect = await importOriginal<typeof import("@confect/js")>();
  return {
    ...confect,
    HttpClient: {
      ...confect.HttpClient,
      layer: (...args: Parameters<typeof confect.HttpClient.layer>) => {
        mocks.layerOptions(args[1]);
        return Layer.effect(
          confect.HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* confect.HttpClient.HttpClient;
            return { ...client, query: mocks.query };
          })
        ).pipe(Layer.provide(confect.HttpClient.layer(...args)));
      },
    },
  };
});

vi.mock("@repo/internationalization/src/routing", () => ({
  previewRouting: { defaultLocale: "en", locales: ["en", "id", "de"] },
  routing: {
    defaultLocale: "en",
    locales: ["en", "id", "de"],
    pathnames: {},
  },
  schoolRouting: { defaultLocale: "en", locales: ["en", "id", "de"] },
}));
/**
 * The school routing picks the locale of a school page as next-intl does: the
 * `NEXT_LOCALE` cookie, then the Accept-Language tag, then the default. The library
 * does not load in this file's node environment, so the double follows its rules
 * and puts the locale in front of the path, as the library rewrites it. Like the
 * library, it passes on a path that it cannot decode, without a rewrite
 * (`next-intl/dist/esm/production/middleware/middleware.js`). The browser tests
 * check the library itself on a server.
 */
vi.mock("next-intl/middleware", async () => {
  const { Array: Arr, Option } = await import("effect");
  const { NextResponse } = await import("next/server");
  const locales = ["en", "id", "de"];
  const negotiate = (request: NextRequest) => {
    const cookie = request.cookies.get("NEXT_LOCALE")?.value;
    if (cookie !== undefined && Arr.contains(locales, cookie)) {
      return cookie;
    }
    const language = request.headers.get("accept-language")?.slice(0, 2);
    if (language !== undefined && Arr.contains(locales, language)) {
      return language;
    }
    return "en";
  };
  const decodes = (pathname: string) =>
    Option.isSome(Option.liftThrowable(decodeURI)(pathname));
  return {
    default: () => (request: NextRequest) => {
      if (!decodes(request.nextUrl.pathname)) {
        return NextResponse.next();
      }
      return NextResponse.rewrite(
        new URL(
          `/${negotiate(request)}${request.nextUrl.pathname}`,
          request.url
        )
      );
    },
  };
});

/** A read of the school that the network did not answer. */
class SchoolOffline extends Data.TaggedError("SchoolOffline") {}

const SCHOOL_ROOT = "https://harapan.nakafa.com/";
const SESSION_COOKIE = "better-auth.session_token=session-value";
const TOKEN = "session-token";

/** A request to a school host, as a browser sends it: the Host header names the URL's host. */
function visit(
  address: string,
  init?: { headers?: HeadersInit; method?: string }
) {
  const url = new URL(address);
  const headers = new Headers(init?.headers);
  headers.set("host", url.host);
  return new NextRequest(url, { headers, method: init?.method ?? "GET" });
}

/** The answer of the refusal for one request, with the log messages it wrote. */
function answerOf(
  address: string,
  init?: { headers?: HeadersInit; method?: string }
) {
  return readSchoolRefusal(visit(address, init)).pipe(
    Effect.provide(Logger.layer([]))
  );
}

/** The answer of the refusal for one request, with the causes that it logged. */
function answerAndCauses(address: string, headers: HeadersInit) {
  return Effect.gen(function* () {
    const causes = MutableList.make<Cause.Cause<unknown>>();
    const answer = yield* readSchoolRefusal(visit(address, { headers })).pipe(
      Effect.provide(
        Logger.layer([
          Logger.make(({ cause }) => {
            MutableList.append(causes, cause);
          }),
        ])
      )
    );
    const logged = MutableList.toArray(causes);
    return {
      answer,
      count: logged.length,
      text: Arr.join(Arr.map(logged, Cause.pretty), "\n"),
    };
  });
}

beforeEach(() => {
  mocks.layerOptions.mockReset();
  mocks.query.mockReset();
  mocks.token.mockReset();
});

describe("school page refusal", () => {
  it.effect(
    "refuses a school that does not exist to a visitor with no session",
    () =>
      Effect.gen(function* () {
        mocks.token.mockReturnValue(Effect.void);
        mocks.query.mockReturnValue(Effect.fail(new TenantNotFound()));

        expect(yield* answerOf(SCHOOL_ROOT)).toEqual(Option.some("en"));
        expect(mocks.token).toHaveBeenCalledWith(
          clientEnv.NEXT_PUBLIC_CONVEX_SITE_URL,
          expect.any(Headers)
        );
        expect(mocks.query).toHaveBeenCalledOnce();
        expect(mocks.query.mock.calls[0]?.[0]).toBe(tenancy.profile.get);
        expect(mocks.query.mock.calls[0]?.[1]).toEqual({ slug: "harapan" });
      })
  );

  it.effect("admits a visitor with no session to a school that exists", () =>
    Effect.gen(function* () {
      mocks.token.mockReturnValue(Effect.void);
      mocks.query.mockReturnValue(Effect.succeed({ name: "Harapan" }));

      expect(yield* answerOf(SCHOOL_ROOT)).toEqual(Option.none());
      expect(mocks.query.mock.calls[0]?.[0]).toBe(tenancy.profile.get);
    })
  );

  it.effect(
    "refuses a signed-in viewer who is not a member of the school",
    () =>
      Effect.gen(function* () {
        mocks.token.mockReturnValue(Effect.succeed(TOKEN));
        mocks.query.mockReturnValue(Effect.fail(new NotMember()));

        expect(
          yield* answerOf(SCHOOL_ROOT, { headers: { cookie: SESSION_COOKIE } })
        ).toEqual(Option.some("en"));
        expect(mocks.layerOptions).toHaveBeenCalledWith({ auth: TOKEN });
        expect(mocks.query.mock.calls[0]?.[0]).toBe(tenancy.viewer.get);
        expect(mocks.query.mock.calls[0]?.[1]).toEqual({ slug: "harapan" });
      })
  );

  it.effect("refuses a signed-in viewer whom the school does not admit", () =>
    Effect.gen(function* () {
      mocks.token.mockReturnValue(Effect.succeed(TOKEN));
      mocks.query.mockReturnValue(
        Effect.fail(new AccessDenied({ action: "tenant.view", reason: "role" }))
      );

      expect(
        yield* answerOf(SCHOOL_ROOT, { headers: { cookie: SESSION_COOKIE } })
      ).toEqual(Option.some("en"));
    })
  );

  it.effect("admits a signed-in member of the school", () =>
    Effect.gen(function* () {
      mocks.token.mockReturnValue(Effect.succeed(TOKEN));
      mocks.query.mockReturnValue(Effect.succeed({ grants: [] }));

      expect(
        yield* answerOf(SCHOOL_ROOT, { headers: { cookie: SESSION_COOKIE } })
      ).toEqual(Option.none());
    })
  );

  it.effect(
    "leaves a session or an account that the app cannot read to the layout",
    () =>
      Effect.gen(function* () {
        mocks.token.mockReturnValue(Effect.succeed(TOKEN));
        mocks.query.mockReturnValue(
          Effect.fail(
            new AccountUnavailable({
              code: "UNAUTHORIZED",
              message: "User not found.",
            })
          )
        );
        expect(
          yield* answerOf(SCHOOL_ROOT, { headers: { cookie: SESSION_COOKIE } })
        ).toEqual(Option.none());

        mocks.query.mockReturnValue(
          Effect.fail(
            new SessionRequired({
              code: "UNAUTHENTICATED",
              message: "Unauthenticated",
            })
          )
        );
        expect(
          yield* answerOf(SCHOOL_ROOT, { headers: { cookie: SESSION_COOKIE } })
        ).toEqual(Option.none());
      })
  );

  it.effect("sends a client navigation and a prefetch on without a read", () =>
    Effect.gen(function* () {
      mocks.token.mockReturnValue(Effect.void);
      mocks.query.mockReturnValue(Effect.fail(new TenantNotFound()));

      expect(
        yield* answerOf(SCHOOL_ROOT, {
          headers: { rsc: "1", "next-router-prefetch": "1" },
        })
      ).toEqual(Option.none());
      expect(yield* answerOf(SCHOOL_ROOT, { headers: { rsc: "1" } })).toEqual(
        Option.none()
      );
      expect(mocks.token).not.toHaveBeenCalled();
      expect(mocks.query).not.toHaveBeenCalled();
    })
  );

  it.effect("sends a POST, such as a server action, on without a read", () =>
    Effect.gen(function* () {
      mocks.token.mockReturnValue(Effect.void);
      mocks.query.mockReturnValue(Effect.fail(new TenantNotFound()));

      expect(yield* answerOf(SCHOOL_ROOT, { method: "POST" })).toEqual(
        Option.none()
      );
      expect(mocks.token).not.toHaveBeenCalled();
      expect(mocks.query).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "reads nothing for the main host or for a bypass file of a school host",
    () =>
      Effect.gen(function* () {
        mocks.token.mockReturnValue(Effect.void);
        mocks.query.mockReturnValue(Effect.fail(new TenantNotFound()));

        expect(yield* answerOf("https://nakafa.com/en/classes")).toEqual(
          Option.none()
        );
        expect(
          yield* answerOf("https://harapan.nakafa.com/robots.txt")
        ).toEqual(Option.none());
        expect(mocks.token).not.toHaveBeenCalled();
        expect(mocks.query).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "answers the locale that the school page negotiates: the cookie, then Accept-Language, then the default",
    () =>
      Effect.gen(function* () {
        mocks.token.mockReturnValue(Effect.void);
        mocks.query.mockReturnValue(Effect.fail(new TenantNotFound()));

        expect(
          yield* answerOf(SCHOOL_ROOT, {
            headers: { cookie: "NEXT_LOCALE=de", "accept-language": "id-ID" },
          })
        ).toEqual(Option.some("de"));
        expect(
          yield* answerOf(SCHOOL_ROOT, {
            headers: { "accept-language": "id-ID" },
          })
        ).toEqual(Option.some("id"));
        expect(yield* answerOf(SCHOOL_ROOT)).toEqual(Option.some("en"));
      })
  );

  it.effect(
    "goes on to the school tree and logs the cause when the session cannot be read",
    () =>
      Effect.gen(function* () {
        const failure = new SessionTokenUnavailable({ reason: "fetch" });
        mocks.token.mockReturnValue(Effect.fail(failure));

        const { answer, count, text } = yield* answerAndCauses(SCHOOL_ROOT, {
          cookie: SESSION_COOKIE,
        });

        expect(answer).toEqual(Option.none());
        expect(mocks.query).not.toHaveBeenCalled();
        expect(count).toBe(1);
        expect(text).toContain("SessionTokenUnavailable");
      })
  );

  it.effect(
    "goes on to the school tree and logs the cause when the school cannot be read",
    () =>
      Effect.gen(function* () {
        mocks.token.mockReturnValue(Effect.void);
        mocks.query.mockReturnValue(Effect.fail(new SchoolOffline()));

        const { answer, count, text } = yield* answerAndCauses(SCHOOL_ROOT, {});

        expect(answer).toEqual(Option.none());
        expect(count).toBe(1);
        expect(text).toContain("SchoolOffline");
      })
  );
});

describe("the route of a school host", () => {
  it.effect(
    "answers a refused school page with the not-found page in the locale of the page",
    () =>
      Effect.gen(function* () {
        mocks.token.mockReturnValue(Effect.void);
        mocks.query.mockReturnValue(Effect.fail(new TenantNotFound()));

        const response = yield* routeSchoolPage(
          visit(SCHOOL_ROOT, { headers: { "accept-language": "de-DE" } })
        );

        expect(response?.status).toBe(404);
        expect(response?.headers.get("x-middleware-rewrite")).toBe(
          "https://harapan.nakafa.com/_not-found/de"
        );
        expect(
          response?.headers.get("x-middleware-request-x-next-intl-locale")
        ).toBe("de");
        expect(response?.headers.get("x-robots-tag")).toBe("noindex");
        expect(response?.headers.get("vary")).toContain("Accept-Language");
        expect(response?.headers.get("vary")).toContain("Cookie");
      })
  );

  it.effect(
    "answers a refused school page through the proxy with the not-found page and 404, before the school tree",
    () =>
      Effect.gen(function* () {
        mocks.token.mockReturnValue(Effect.void);
        mocks.query.mockReturnValue(Effect.fail(new TenantNotFound()));

        const response = yield* Effect.promise(() => proxy(visit(SCHOOL_ROOT)));

        expect(response.status).toBe(404);
        expect(response.headers.get("x-middleware-rewrite")).toBe(
          "https://harapan.nakafa.com/_not-found/en"
        );
        expect(response.headers.get("x-robots-tag")).toBe("noindex");
      })
  );

  it.effect(
    "answers a path that next-intl cannot decode the same for a refused school and an admitted one",
    () =>
      Effect.gen(function* () {
        mocks.token.mockReturnValue(Effect.void);
        mocks.query.mockReturnValue(Effect.fail(new TenantNotFound()));
        const refused = yield* routeSchoolPage(
          visit("https://harapan.nakafa.com/%")
        );

        mocks.query.mockReturnValue(Effect.succeed({ name: "Harapan" }));
        const admitted = yield* routeSchoolPage(
          visit("https://harapan.nakafa.com/%")
        );

        expect(refused?.headers.get("x-middleware-next")).toBe("1");
        expect(refused?.headers.get("x-middleware-rewrite")).toBeNull();
        expect(admitted?.headers.get("x-middleware-next")).toBe("1");
        expect(admitted?.headers.get("x-middleware-rewrite")).toBeNull();
      })
  );

  it.effect("routes an admitted school page to its school tree", () =>
    Effect.gen(function* () {
      mocks.token.mockReturnValue(Effect.void);
      mocks.query.mockReturnValue(Effect.succeed({ name: "Harapan" }));

      const response = yield* routeSchoolPage(visit(SCHOOL_ROOT));

      expect(response?.headers.get("x-middleware-rewrite")).toBe(
        "https://harapan.nakafa.com/en/school/harapan"
      );
    })
  );

  it.effect(
    "rewrites an admitted school page through the proxy before the public routes read it",
    () =>
      Effect.gen(function* () {
        mocks.token.mockReturnValue(Effect.void);
        mocks.query.mockReturnValue(Effect.succeed({ name: "Harapan" }));

        const response = yield* Effect.promise(() =>
          proxy(visit("https://harapan.nakafa.com/classes"))
        );

        expect(response.headers.get("x-middleware-rewrite")).toBe(
          "https://harapan.nakafa.com/en/school/harapan/classes"
        );
        expect(response.headers.get("x-robots-tag")).toBe("noindex");
      })
  );

  it.effect("leaves a request of the main host to the public routes", () =>
    Effect.gen(function* () {
      expect(
        yield* routeSchoolPage(visit("https://nakafa.com/en/classes"))
      ).toBeNull();
      expect(mocks.token).not.toHaveBeenCalled();
    })
  );
});
