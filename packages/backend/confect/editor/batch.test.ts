import { describe, expect, it } from "@effect/vitest";
import {
  admitBatch,
  type Batch,
  BatchSchema,
  decodeBatch,
  encodeBatch,
  MAX_CLIENT_ID_LENGTH,
} from "@repo/backend/confect/editor/batch";
import {
  MAX_BATCH_BYTES,
  MAX_BATCH_STEPS,
  utf8Bytes,
} from "@repo/backend/confect/editor/size";
import type { Step } from "@repo/backend/confect/editor/step";
import { nested } from "@repo/backend/test/editor/nodes";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, Effect, Schema } from "effect";

/** A step that is valid whatever the document holds. */
const oneStep: Step = {
  mark: { type: "bold" },
  pos: 0,
  stepType: "addNodeMark",
};

/** A batch of `count` steps that `clientId` made on `baseVersion`. */
function batchOf(clientId: string, baseVersion: number, count: number): Batch {
  return { baseVersion, clientId, steps: Arr.makeBy(count, () => oneStep) };
}

/**
 * A batch of one step whose JSON value is `text`. The client id is bounded, so
 * a test that sets the size of the call uses the value of a step instead.
 */
function batchWithText(text: string): Batch {
  return {
    baseVersion: 0,
    clientId: "rina",
    steps: [{ attr: "title", stepType: "docAttr", value: text }],
  };
}

describe("editor/batch version rule", () => {
  it.effect(
    "admits a batch on the version it names and counts up by its steps",
    () =>
      Effect.gen(function* () {
        const rina = yield* admitBatch(
          0,
          yield* encodeBatch(batchOf("rina", 0, 2))
        );
        expect(rina.version).toBe(2);
        expect(rina.batch).toEqual(batchOf("rina", 0, 2));

        const hendra = yield* admitBatch(
          40,
          yield* encodeBatch(batchOf("hendra", 40, 3))
        );
        expect(hendra.version).toBe(43);
      })
  );

  it.effect.each([
    { baseVersion: 39, version: 40 },
    { baseVersion: 41, version: 40 },
  ])(
    "refuses a batch made on version $baseVersion when the document is at $version",
    ({ baseVersion, version }) =>
      Effect.gen(function* () {
        const text = yield* encodeBatch(batchOf("rina", baseVersion, 1));
        const failure = yield* admitBatch(version, text).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "StaleBatch",
          baseVersion,
          version,
        });
      })
  );

  it.effect("refuses a call over the step bound on the version it names", () =>
    Effect.gen(function* () {
      // One step more than the bound, on the version the document is at, so only the bound refuses it.
      const step = '{"mark":{"type":"bold"},"pos":0,"stepType":"addNodeMark"}';
      const steps = Arr.join(
        Arr.makeBy(MAX_BATCH_STEPS + 1, () => step),
        ","
      );
      const text = `{"baseVersion":40,"clientId":"rina","steps":[${steps}]}`;
      const failure = yield* admitBatch(40, text).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
      expect(failure.message).toContain(`at most ${MAX_BATCH_STEPS} steps`);
    })
  );
});

describe("editor/batch limits", () => {
  it.effect("reads a batch of one step up to MAX_BATCH_STEPS steps", () =>
    Effect.gen(function* () {
      yield* Schema.decodeEffect(BatchSchema)(batchOf("rina", 0, 1));
      yield* Schema.decodeEffect(BatchSchema)(
        batchOf("rina", 0, MAX_BATCH_STEPS)
      );
    })
  );

  it.effect(
    "refuses a batch with no step, and one step more than the bound",
    () =>
      Effect.gen(function* () {
        const none = yield* Schema.decodeUnknownEffect(BatchSchema)({
          baseVersion: 0,
          clientId: "rina",
          steps: [],
        }).pipe(Effect.flip);
        expect(none._tag).toBe("SchemaError");

        const more = yield* Schema.decodeEffect(BatchSchema)(
          batchOf("rina", 0, MAX_BATCH_STEPS + 1)
        ).pipe(Effect.flip);
        expect(more.message).toContain(`at most ${MAX_BATCH_STEPS} steps`);
      })
  );

  it.effect("refuses a batch made on a negative version", () =>
    Effect.gen(function* () {
      const failure = yield* Schema.decodeEffect(BatchSchema)({
        baseVersion: -1,
        clientId: "rina",
        steps: [oneStep],
      }).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
    })
  );

  it.effect("refuses a batch without a client", () =>
    Effect.gen(function* () {
      const failure = yield* Schema.decodeEffect(BatchSchema)({
        baseVersion: 0,
        clientId: "",
        steps: [oneStep],
      }).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
    })
  );

  it.effect("refuses a client id longer than MAX_CLIENT_ID_LENGTH", () =>
    Effect.gen(function* () {
      const failure = yield* Schema.decodeEffect(BatchSchema)({
        baseVersion: 0,
        clientId: "x".repeat(MAX_CLIENT_ID_LENGTH + 1),
        steps: [oneStep],
      }).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
      expect(failure.message).toContain(
        `at most ${MAX_CLIENT_ID_LENGTH} characters`
      );
    })
  );

  it.effect("accepts the client id that randomUuid makes", () =>
    Effect.gen(function* () {
      const clientId = yield* randomUuid;
      yield* Schema.decodeEffect(BatchSchema)({
        baseVersion: 0,
        clientId,
        steps: [oneStep],
      });
    })
  );

  it.effect(
    "writes a batch at exactly MAX_BATCH_BYTES and refuses one byte more",
    () =>
      Effect.gen(function* () {
        const base = utf8Bytes(yield* encodeBatch(batchWithText("")));
        const room = MAX_BATCH_BYTES - base;
        const text = yield* encodeBatch(batchWithText("x".repeat(room)));
        expect(utf8Bytes(text)).toBe(MAX_BATCH_BYTES);
        const refused = yield* encodeBatch(
          batchWithText("x".repeat(room + 1))
        ).pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "BatchTooLarge",
          bytes: MAX_BATCH_BYTES + 1,
          limit: MAX_BATCH_BYTES,
        });
      })
  );

  it.effect(
    "refuses a batch whose slice is nested 100,000 levels on write as a schema issue",
    () =>
      Effect.gen(function* () {
        const failure = yield* encodeBatch({
          baseVersion: 0,
          clientId: "rina",
          steps: [
            {
              from: 0,
              slice: { content: [nested(100_000)] },
              stepType: "replace",
              to: 0,
            },
          ],
        }).pipe(Effect.flip);
        expect(failure._tag).toBe("SchemaError");
      })
  );
});

describe("editor/batch call body", () => {
  it.effect("reads the text of a call at exactly MAX_BATCH_BYTES", () =>
    Effect.gen(function* () {
      const base = utf8Bytes(yield* encodeBatch(batchWithText("")));
      const full = batchWithText("x".repeat(MAX_BATCH_BYTES - base));
      const text = yield* encodeBatch(full);
      expect(utf8Bytes(text)).toBe(MAX_BATCH_BYTES);
      expect(yield* decodeBatch(text)).toEqual(full);
    })
  );

  it.effect(
    "refuses a call over MAX_BATCH_BYTES before it reads the text",
    () =>
      Effect.gen(function* () {
        // The padding is an undeclared key, so a read of the text would refuse it as a schema issue.
        const padding = "x".repeat(MAX_BATCH_BYTES);
        const text = `{"baseVersion":0,"clientId":"rina","pad":"${padding}","steps":[{"mark":{"type":"bold"},"pos":0,"stepType":"addNodeMark"}]}`;
        const failure = yield* decodeBatch(text).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "BatchTooLarge",
          limit: MAX_BATCH_BYTES,
        });
        expect(failure).toHaveProperty("bytes", utf8Bytes(text));
        expect(utf8Bytes(text)).toBeGreaterThan(MAX_BATCH_BYTES);
      })
  );

  it.effect("refuses an undeclared key in a call rather than dropping it", () =>
    Effect.gen(function* () {
      const failure = yield* decodeBatch(
        '{"baseVersion":0,"clientId":"rina","extra":1,"steps":[{"mark":{"type":"bold"},"pos":0,"stepType":"addNodeMark"}]}'
      ).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
    })
  );
});
