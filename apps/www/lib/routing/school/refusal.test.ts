// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import { Effect, Fiber, Option } from "effect";
import { TestClock } from "effect/testing";
import type { NextRequest } from "next/server";
import { routeSchoolPage } from "@/lib/routing/school/refusal";
import { proxy } from "@/proxy";
import {
  answerAndCauses,
  answered,
  answerOf,
  fetcher,
  queriesOf,
  REFUSAL,
  requestsTo,
  resetFakeBackend,
  SCHOOL_ROOT,
  SESSION_COOKIE,
  serve,
  signedIn,
  silent,
  TOKEN,
  TOKEN_PATH,
  tokenRefused,
  unreachable,
  visit,
} from "@/test/school";

/** A school page reads no server value, so the server environment is a stand-in here. */
vi.mock("@/env", () => ({ env: {} }));
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

beforeEach(() => {
  resetFakeBackend();
});

describe("school page refusal", () => {
  it.effect(
    "refuses a school that does not exist to a visitor with no session",
    () =>
      Effect.gen(function* () {
        serve({ refusal: answered(true) });

        expect(yield* answerOf(SCHOOL_ROOT)).toEqual(Option.some("en"));
        expect(requestsTo(TOKEN_PATH)).toHaveLength(0);
        expect(queriesOf()).toEqual([
          { auth: null, path: REFUSAL, slug: "harapan" },
        ]);
      })
  );

  it.effect("admits a visitor with no session to a school that exists", () =>
    Effect.gen(function* () {
      serve({ refusal: answered(false) });

      const { answer, count } = yield* answerAndCauses(SCHOOL_ROOT, {});

      expect(answer).toEqual(Option.none());
      expect(count).toBe(0);
      expect(queriesOf()).toEqual([
        { auth: null, path: REFUSAL, slug: "harapan" },
      ]);
    })
  );

  it.effect(
    "admits a signed-in viewer who is not a member of a school that exists, in one query, so its layout shows the outsider page",
    () =>
      Effect.gen(function* () {
        serve({ refusal: answered(false), token: signedIn });

        expect(
          yield* answerOf(SCHOOL_ROOT, { headers: { cookie: SESSION_COOKIE } })
        ).toEqual(Option.none());
        expect(queriesOf()).toEqual([
          { auth: `Bearer ${TOKEN}`, path: REFUSAL, slug: "harapan" },
        ]);
      })
  );

  it.effect(
    "refuses a signed-in viewer who is not a member of a school that does not exist",
    () =>
      Effect.gen(function* () {
        serve({ refusal: answered(true), token: signedIn });

        expect(
          yield* answerOf(SCHOOL_ROOT, { headers: { cookie: SESSION_COOKIE } })
        ).toEqual(Option.some("en"));
        expect(queriesOf()).toHaveLength(1);
      })
  );

  it.effect("refuses a signed-in viewer whom the school does not admit", () =>
    Effect.gen(function* () {
      serve({ refusal: answered(true), token: signedIn });

      expect(
        yield* answerOf(SCHOOL_ROOT, { headers: { cookie: SESSION_COOKIE } })
      ).toEqual(Option.some("en"));
    })
  );

  it.effect("admits a signed-in member of the school", () =>
    Effect.gen(function* () {
      serve({ refusal: answered(false), token: signedIn });

      const { answer, count } = yield* answerAndCauses(SCHOOL_ROOT, {
        cookie: SESSION_COOKIE,
      });

      expect(answer).toEqual(Option.none());
      expect(count).toBe(0);
      expect(queriesOf()).toEqual([
        { auth: `Bearer ${TOKEN}`, path: REFUSAL, slug: "harapan" },
      ]);
    })
  );

  it.effect("sends a client navigation and a prefetch on without a read", () =>
    Effect.gen(function* () {
      serve({ refusal: answered(true) });

      expect(
        yield* answerOf(SCHOOL_ROOT, {
          headers: { rsc: "1", "next-router-prefetch": "1" },
        })
      ).toEqual(Option.none());
      expect(yield* answerOf(SCHOOL_ROOT, { headers: { rsc: "1" } })).toEqual(
        Option.none()
      );
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect("sends a POST, such as a server action, on without a read", () =>
    Effect.gen(function* () {
      serve({ refusal: answered(true) });

      expect(yield* answerOf(SCHOOL_ROOT, { method: "POST" })).toEqual(
        Option.none()
      );
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "reads nothing for the main host or for a bypass file of a school host",
    () =>
      Effect.gen(function* () {
        serve({ refusal: answered(true) });

        expect(yield* answerOf("https://nakafa.com/en/classes")).toEqual(
          Option.none()
        );
        expect(
          yield* answerOf("https://harapan.nakafa.com/robots.txt")
        ).toEqual(Option.none());
        expect(fetcher).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "answers the locale that the school page negotiates: the cookie, then Accept-Language, then the default",
    () =>
      Effect.gen(function* () {
        serve({ refusal: answered(true) });

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
        serve({ token: tokenRefused });

        const { answer, count, text } = yield* answerAndCauses(SCHOOL_ROOT, {
          cookie: SESSION_COOKIE,
        });

        expect(answer).toEqual(Option.none());
        expect(queriesOf()).toHaveLength(0);
        expect(count).toBe(1);
        expect(text).toContain("SessionTokenUnavailable");
      })
  );

  it.effect(
    "goes on to the school tree and logs the cause when the school cannot be read",
    () =>
      Effect.gen(function* () {
        serve({ refusal: unreachable });

        const { answer, count, text } = yield* answerAndCauses(SCHOOL_ROOT, {});

        expect(answer).toEqual(Option.none());
        expect(count).toBe(1);
        expect(text).toContain("fetch failed");
      })
  );

  it.effect(
    "makes one attempt at a school read that the network refuses, and does not repeat it",
    () =>
      Effect.gen(function* () {
        serve({ refusal: unreachable });

        expect(yield* answerOf(SCHOOL_ROOT)).toEqual(Option.none());
        expect(queriesOf()).toHaveLength(1);
      })
  );

  it.effect(
    "goes on to the school tree and logs the deadline when the school does not answer in time",
    () =>
      Effect.gen(function* () {
        serve({ refusal: silent });

        const fiber = yield* Effect.forkChild(answerAndCauses(SCHOOL_ROOT, {}));
        yield* TestClock.adjust(NETWORK_ATTEMPT_DEADLINE);
        const { answer, count, text } = yield* Fiber.join(fiber);

        expect(answer).toEqual(Option.none());
        expect(count).toBe(1);
        expect(text).toContain("SchoolReadDeadline");
      })
  );

  it.effect(
    "bounds the session read of a signed-in visitor by the same deadline",
    () =>
      Effect.gen(function* () {
        serve({ token: silent });

        const fiber = yield* Effect.forkChild(
          answerAndCauses(SCHOOL_ROOT, { cookie: SESSION_COOKIE })
        );
        yield* TestClock.adjust(NETWORK_ATTEMPT_DEADLINE);
        const { answer, count, text } = yield* Fiber.join(fiber);

        expect(answer).toEqual(Option.none());
        expect(queriesOf()).toHaveLength(0);
        expect(count).toBe(1);
        expect(text).toContain("SchoolReadDeadline");
      })
  );
});

describe("the route of a school host", () => {
  it.effect(
    "answers a refused school page with the not-found page in the locale of the page",
    () =>
      Effect.gen(function* () {
        serve({ refusal: answered(true) });

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
        serve({ refusal: answered(true) });

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
        serve({ refusal: answered(true) });
        const refused = yield* routeSchoolPage(
          visit("https://harapan.nakafa.com/%")
        );

        serve({ refusal: answered(false) });
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
      serve({ refusal: answered(false) });

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
        serve({ refusal: answered(false) });

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
      expect(fetcher).not.toHaveBeenCalled();
    })
  );
});
