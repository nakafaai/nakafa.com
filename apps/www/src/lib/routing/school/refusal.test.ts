// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import { Effect, Fiber, Option } from "effect";
import { TestClock } from "effect/testing";
import { readSchoolRefusal } from "@/lib/routing/school/refusal";
import {
  answerAndCauses,
  answered,
  answerOf,
  fetcher,
  queriesOf,
  REFUSAL,
  resetFakeBackend,
  SCHOOL_ROOT,
  SESSION_COOKIE,
  serve,
  silent,
  unreachable,
} from "@/test/school";

/** A school page reads no server value, so the server environment is a stand-in here. */
vi.mock("@/env", () => ({ env: {} }));
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
        expect(queriesOf()).toEqual([
          { auth: null, path: REFUSAL, slug: "harapan" },
        ]);
      })
  );

  it.effect("asks Convex once for repeated visits to one host", () =>
    Effect.gen(function* () {
      serve({ refusal: answered(true) });

      for (const _ of [1, 2, 3]) {
        expect(yield* answerOf(SCHOOL_ROOT)).toEqual(Option.some("en"));
      }

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
    "reads nothing for a request with a session, so the page's own gate decides it in the browser",
    () =>
      Effect.gen(function* () {
        serve({ refusal: answered(true) });

        const { answer, count } = yield* answerAndCauses(SCHOOL_ROOT, {
          cookie: SESSION_COOKIE,
        });

        expect(answer).toEqual(Option.none());
        expect(count).toBe(0);
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
            headers: { cookie: "NAKAFA_LOCALE=de", "accept-language": "id-ID" },
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
});

describe("school page refusal answer", () => {
  it.effect(
    "answers a refused school page with the not-found locale that it negotiates",
    () =>
      Effect.gen(function* () {
        serve({ refusal: answered(true) });

        const locale = Option.getOrThrow(
          yield* readSchoolRefusal(
            new Request(SCHOOL_ROOT, {
              headers: { "accept-language": "id-ID,id;q=0.9" },
            })
          )
        );

        expect(locale).toBe("id");
      })
  );

  it.effect("answers none for a school page that the school admits", () =>
    Effect.gen(function* () {
      serve({ refusal: answered(false) });

      expect(
        Option.isNone(yield* readSchoolRefusal(new Request(SCHOOL_ROOT)))
      ).toBe(true);
    })
  );

  it.effect("answers none for a method that is not a page read", () =>
    Effect.gen(function* () {
      serve({ refusal: answered(true) });

      expect(
        Option.isNone(
          yield* readSchoolRefusal(new Request(SCHOOL_ROOT, { method: "POST" }))
        )
      ).toBe(true);
      expect(queriesOf()).toHaveLength(0);
    })
  );
});
