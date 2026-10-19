// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import { Effect, Fiber, Option } from "effect";
import { TestClock } from "effect/testing";
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
