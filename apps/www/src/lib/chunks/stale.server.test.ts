// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { STALE_FUNCTION_MESSAGE } from "@/lib/chunks/stale";
import { answerStaleFunction } from "@/lib/chunks/stale.server";

const CALL = new Request("https://nakafa.com/_serverFn/gone", {
  method: "POST",
});

/** Start's answer to a call whose id this release does not hold, as production writes it. */
const unknownFunction = () =>
  new Response(
    '{"t":10,"p":{"v":[{"s":{"message":{"s":"Server function info not found for gone"}}}]}}',
    { status: 500 }
  );

describe("answerStaleFunction", () => {
  it.effect("answers a function that a deploy removed as gone", () =>
    Effect.gen(function* () {
      const response = yield* answerStaleFunction(CALL, unknownFunction());

      expect(response.status).toBe(410);
      expect(yield* Effect.promise(() => response.text())).toBe(
        STALE_FUNCTION_MESSAGE
      );
    })
  );

  it.effect("keeps every other failure of a server function", () =>
    Effect.gen(function* () {
      const failure = new Response("The read failed.", { status: 500 });

      expect(yield* answerStaleFunction(CALL, failure)).toBe(failure);
    })
  );

  it.effect("keeps a failed page and a working function untouched", () =>
    Effect.gen(function* () {
      const page = new Request("https://nakafa.com/en");
      const failed = unknownFunction();
      const working = new Response("{}");

      expect(yield* answerStaleFunction(page, failed)).toBe(failed);
      expect(yield* answerStaleFunction(CALL, working)).toBe(working);
    })
  );
});
