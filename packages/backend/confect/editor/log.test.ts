import { describe, expect, it } from "@effect/vitest";
import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { encodeStoredStep } from "@repo/backend/confect/editor/log";
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
      const row = yield* encodeStoredStep({
        author,
        clientId: "rina-tab",
        step: oneStep,
      });
      expect(row).toMatchObject({ author: "users_rina", clientId: "rina-tab" });
      expect(typeof row.step).toBe("string");
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
