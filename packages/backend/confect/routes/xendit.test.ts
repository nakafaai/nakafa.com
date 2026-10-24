import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { Array as Arr, Effect, Schema } from "effect";

const TOKEN = "callback-token-test";
const DELIVERY = `{"business_id":"biz_1","created":"2026-10-24T10:00:00Z","data":{"id":"recy_1","status":"SUCCEEDED","updated":"2026-10-24T10:00:01Z"},"event":"recurring.cycle.succeeded"}`;

/** Posts one body to the Xendit route with the given callback token. */
const post = Effect.fn("routes.xendit.test.post")(function* (
  body: string,
  token: string | null
) {
  const target = yield* Confect.pipe(Effect.provide(confectLayer));
  return yield* target.fetch("/xendit/events", {
    body,
    headers:
      token === null
        ? { "content-type": "application/json" }
        : { "content-type": "application/json", "x-callback-token": token },
    method: "POST",
  });
});

describe("routes/xendit", () => {
  beforeEach(() => {
    vi.stubEnv("XENDIT_WEBHOOK_TOKEN", TOKEN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect("refuses a delivery without the callback token", () =>
    Effect.gen(function* () {
      const response = yield* post(DELIVERY, null);
      expect(response.status).toBe(403);
    })
  );

  it.effect("refuses a delivery with another callback token", () =>
    Effect.gen(function* () {
      const response = yield* post(DELIVERY, "not-the-token");
      expect(response.status).toBe(403);
    })
  );

  it.effect("refuses a body that is not a Xendit webhook", () =>
    Effect.gen(function* () {
      const response = yield* post('{"event": 1}', TOKEN);
      expect(response.status).toBe(400);
    })
  );

  it.effect("stores a delivery once and accepts its redelivery", () =>
    Effect.gen(function* () {
      const target = yield* Confect;
      const first = yield* post(DELIVERY, TOKEN);
      const again = yield* post(DELIVERY, TOKEN);
      const keys = yield* target.run(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          const rows = yield* reader
            .table("billingEvents")
            .index("by_receivedAt")
            .take(10)
            .pipe(Effect.orDie);
          return Arr.join(
            Arr.map(rows, (row) => row.key),
            "|"
          );
        }),
        Schema.String
      );
      expect([first.status, again.status]).toEqual([202, 202]);
      expect(keys).toBe(
        "recurring.cycle.succeeded:recy_1:SUCCEEDED:2026-10-24T10:00:01Z"
      );
    }).pipe(Effect.provide(confectLayer))
  );

  it.effect(
    "answers with a server error when the callback token is not configured",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("XENDIT_WEBHOOK_TOKEN", "");
        const response = yield* post(DELIVERY, TOKEN);
        expect(response.status).toBe(500);
      })
  );
});
