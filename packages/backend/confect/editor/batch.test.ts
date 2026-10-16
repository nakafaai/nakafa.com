import { describe, expect, it } from "@effect/vitest";
import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import {
  admitBatch,
  type Batch,
  BatchSchema,
  decodeBatch,
  encodeBatch,
  MAX_ID_LENGTH,
  MAX_STEP_BYTES,
} from "@repo/backend/confect/editor/batch";
import { MAX_BATCH_BYTES } from "@repo/backend/confect/editor/size";
import { encodeStep, type Step } from "@repo/backend/confect/editor/step";
import { nested } from "@repo/backend/test/editor/nodes";
import { encodeJsonText } from "@repo/utilities/json";
import { utf8Bytes } from "@repo/utilities/text";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, Effect, Schema } from "effect";

/** A step that is valid whatever the document holds. */
const oneStep: Step = {
  mark: { type: "bold" },
  pos: 0,
  stepType: "addNodeMark",
};

/** A batch of `count` steps that `clientId` made on `baseVersion`, under a batch id of its own. */
function batchOf(clientId: string, baseVersion: number, count: number): Batch {
  return {
    baseVersion,
    batch: `${clientId}-${baseVersion}-${count}`,
    clientId,
    steps: Arr.makeBy(count, () => oneStep),
  };
}

/**
 * A batch of one step whose JSON value is `text`. The client id is bounded, so
 * a test that sets the size of the call uses the value of a step instead.
 */
function batchWithText(text: string): Batch {
  return {
    baseVersion: 0,
    batch: "rina-text",
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
          yield* decodeBatch(yield* encodeBatch(batchOf("rina", 0, 2)))
        );
        expect(rina.version).toBe(2);
        expect(rina.batch).toEqual(batchOf("rina", 0, 2));

        const hendra = yield* admitBatch(
          40,
          yield* decodeBatch(yield* encodeBatch(batchOf("hendra", 40, 3)))
        );
        expect(hendra.version).toBe(43);
      })
  );

  it.effect.each([
    { baseVersion: 39, head: 40 },
    { baseVersion: 41, head: 40 },
  ])(
    "refuses a batch made on version $baseVersion when the document is at $head",
    ({ baseVersion, head }) =>
      Effect.gen(function* () {
        const batch = batchOf("rina", baseVersion, 1);
        const failure = yield* admitBatch(head, batch).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "VersionStale",
          baseVersion,
          head,
        });
      })
  );

  it.effect("refuses a call over the step bound on the version it names", () =>
    Effect.gen(function* () {
      // One step more than the 200-step bound of ADR 0028, on the version the document is at, so only the bound refuses it.
      const step = '{"mark":{"type":"bold"},"pos":0,"stepType":"addNodeMark"}';
      const steps = Arr.join(
        Arr.makeBy(201, () => step),
        ","
      );
      const text = `{"baseVersion":40,"batch":"rina-40","clientId":"rina","steps":[${steps}]}`;
      const failure = yield* decodeBatch(text).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
      expect(failure.message).toContain("at most 200 steps");
    })
  );
});

describe("editor/batch limits", () => {
  it.effect(
    "reads a batch of one step, and a batch of 200 steps, the bound of ADR 0028",
    () =>
      Effect.gen(function* () {
        yield* Schema.decodeEffect(BatchSchema)(batchOf("rina", 0, 1));
        yield* Schema.decodeEffect(BatchSchema)(batchOf("rina", 0, 200));
      })
  );

  it.effect(
    "refuses a batch with no step, and one step more than the bound",
    () =>
      Effect.gen(function* () {
        const none = yield* Schema.decodeUnknownEffect(BatchSchema)({
          baseVersion: 0,
          batch: "rina-0",
          clientId: "rina",
          steps: [],
        }).pipe(Effect.flip);
        expect(none._tag).toBe("SchemaError");

        const more = yield* Schema.decodeEffect(BatchSchema)(
          batchOf("rina", 0, 201)
        ).pipe(Effect.flip);
        expect(more.message).toContain("at most 200 steps");
      })
  );

  it.effect("refuses a batch made on a negative version", () =>
    Effect.gen(function* () {
      const failure = yield* Schema.decodeEffect(BatchSchema)({
        baseVersion: -1,
        batch: "rina-0",
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
        batch: "rina-0",
        clientId: "",
        steps: [oneStep],
      }).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
    })
  );

  it.effect("refuses a client id longer than MAX_ID_LENGTH", () =>
    Effect.gen(function* () {
      const failure = yield* Schema.decodeEffect(BatchSchema)({
        baseVersion: 0,
        batch: "rina-0",
        clientId: "x".repeat(MAX_ID_LENGTH + 1),
        steps: [oneStep],
      }).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
      expect(failure.message).toContain(`at most ${MAX_ID_LENGTH} characters`);
    })
  );

  it.effect(
    "refuses a batch without a batch id, and one id longer than the bound",
    () =>
      Effect.gen(function* () {
        const missing = yield* Schema.decodeUnknownEffect(BatchSchema)({
          baseVersion: 0,
          clientId: "rina",
          steps: [oneStep],
        }).pipe(Effect.flip);
        expect(missing._tag).toBe("SchemaError");
        const long = yield* Schema.decodeEffect(BatchSchema)({
          baseVersion: 0,
          batch: "b".repeat(MAX_ID_LENGTH + 1),
          clientId: "rina",
          steps: [oneStep],
        }).pipe(Effect.flip);
        expect(long.message).toContain(`at most ${MAX_ID_LENGTH} characters`);
      })
  );

  it.effect("accepts the client and batch ids that randomUuid makes", () =>
    Effect.gen(function* () {
      const clientId = yield* randomUuid;
      const batch = yield* randomUuid;
      yield* Schema.decodeEffect(BatchSchema)({
        baseVersion: 0,
        batch,
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
    "carries a step of exactly MAX_STEP_BYTES in a call with the longest ids and version, and refuses one byte more",
    () =>
      Effect.gen(function* () {
        const longest = "x".repeat(MAX_ID_LENGTH);
        const callWith = (value: string) =>
          encodeBatch({
            baseVersion: Number.MAX_SAFE_INTEGER,
            batch: longest,
            clientId: longest,
            steps: [{ attr: "title", stepType: "docAttr", value }],
          });
        const base = utf8Bytes(
          yield* encodeStep({ attr: "title", stepType: "docAttr", value: "" })
        );
        const room = MAX_STEP_BYTES - base;
        const text = yield* callWith("x".repeat(room));
        expect(utf8Bytes(text)).toBe(MAX_BATCH_BYTES);
        const refused = yield* callWith("x".repeat(room + 1)).pipe(Effect.flip);
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
          batch: "rina-0",
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
        const text = `{"baseVersion":0,"batch":"rina-0","clientId":"rina","pad":"${padding}","steps":[{"mark":{"type":"bold"},"pos":0,"stepType":"addNodeMark"}]}`;
        const failure = yield* decodeBatch(text).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "BatchTooLarge",
          limit: MAX_BATCH_BYTES,
        });
        expect(failure).toHaveProperty("bytes", utf8Bytes(text));
        expect(utf8Bytes(text)).toBeGreaterThan(MAX_BATCH_BYTES);
      })
  );

  it.effect(
    "refuses a call whose attributes nest past the bound, so no admitted call is unstorable",
    () =>
      Effect.gen(function* () {
        // The call is well within MAX_BATCH_BYTES, and its attributes nest 20,000 objects deep.
        const depth = 20_000;
        const attrs = `${'{"a":'.repeat(depth)}{}${"}".repeat(depth)}`;
        const text = `{"baseVersion":40,"batch":"rina-40","clientId":"rina","steps":[{"mark":{"type":"bold","attrs":${attrs}},"pos":0,"stepType":"addNodeMark"}]}`;
        expect(utf8Bytes(text)).toBeLessThan(MAX_BATCH_BYTES);
        const failure = yield* decodeBatch(text).pipe(Effect.flip);
        expect(failure._tag).toBe("SchemaError");
        expect(failure.message).toContain(
          `at most ${MAX_DOCUMENT_DEPTH} levels deep`
        );
      })
  );

  it.effect("refuses an undeclared key in a call rather than dropping it", () =>
    Effect.gen(function* () {
      const failure = yield* decodeBatch(
        '{"baseVersion":0,"batch":"rina-0","clientId":"rina","extra":1,"steps":[{"mark":{"type":"bold"},"pos":0,"stepType":"addNodeMark"}]}'
      ).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
    })
  );
});

describe("editor/batch node and mark types", () => {
  it.effect(
    "reads a batch whose step adds a mark the editor reads, and refuses one that adds a mark it does not",
    () =>
      Effect.gen(function* () {
        const markBatch = (type: string) =>
          encodeJsonText({
            baseVersion: 0,
            batch: `rina-mark-${type}`,
            clientId: "rina",
            steps: [{ from: 1, mark: { type }, stepType: "addMark", to: 2 }],
          });
        const read = yield* decodeBatch(markBatch("bold"));
        expect(read.steps).toEqual([
          { from: 1, mark: { type: "bold" }, stepType: "addMark", to: 2 },
        ]);
        const refused = yield* decodeBatch(markBatch("strike")).pipe(
          Effect.flip
        );
        expect(refused._tag).toBe("SchemaError");
      })
  );

  it.effect(
    "reads a batch whose step holds a paragraph, and refuses one that holds a table the editor does not read",
    () =>
      Effect.gen(function* () {
        const nodeBatch = (type: string) =>
          encodeJsonText({
            baseVersion: 0,
            batch: `rina-node-${type}`,
            clientId: "rina",
            steps: [
              {
                from: 0,
                slice: {
                  content: [{ content: [{ text: "x", type: "text" }], type }],
                },
                stepType: "replace",
                to: 0,
              },
            ],
          });
        yield* decodeBatch(nodeBatch("paragraph"));
        const refused = yield* decodeBatch(nodeBatch("table")).pipe(
          Effect.flip
        );
        expect(refused._tag).toBe("SchemaError");
      })
  );
});
