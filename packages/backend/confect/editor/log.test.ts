import { describe, expect, it } from "@effect/vitest";
import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  decodeStoredStep,
  encodeStoredStep,
} from "@repo/backend/confect/editor/log";
import type { Step } from "@repo/backend/confect/editor/step";
import { nested } from "@repo/backend/test/editor/nodes";
import { Effect, Schema } from "effect";

/** A step that is valid whatever the document holds. */
const oneStep: Step = {
  mark: { type: "bold" },
  pos: 0,
  stepType: "addNodeMark",
};

describe("editor/log stored steps", () => {
  it.effect("keeps the author and the client of each stored step", () =>
    Effect.gen(function* () {
      const author = yield* Schema.decodeUnknownEffect(IdSchema("users"))(
        "users_rina"
      );
      const stored = { author, clientId: "rina-tab", step: oneStep };
      const row = yield* encodeStoredStep(stored);
      expect(row).toMatchObject({ author: "users_rina", clientId: "rina-tab" });
      expect(yield* decodeStoredStep(row)).toEqual(stored);
    })
  );

  it.effect("refuses a stored row without an author", () =>
    Effect.gen(function* () {
      const failure = yield* decodeStoredStep({
        clientId: "rina-tab",
        step: '{"mark":{"type":"bold"},"pos":0,"stepType":"addNodeMark"}',
      }).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
    })
  );

  it.effect(
    "refuses a stored step whose slice is one level deeper than the bound",
    () =>
      Effect.gen(function* () {
        const author = yield* Schema.decodeUnknownEffect(IdSchema("users"))(
          "users_rina"
        );
        const deep: Step = {
          from: 0,
          slice: { content: [nested(MAX_DOCUMENT_DEPTH + 1)] },
          stepType: "replace",
          to: 0,
        };
        const failure = yield* encodeStoredStep({
          author,
          clientId: "rina-tab",
          step: deep,
        }).pipe(Effect.flip);
        expect(failure._tag).toBe("SchemaError");
        expect(failure.message).toContain(
          `at most ${MAX_DOCUMENT_DEPTH} levels deep`
        );
      })
  );
});
