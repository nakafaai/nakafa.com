import { describe, expect, it } from "@effect/vitest";
import { STEP_PAGE_STEPS } from "@repo/backend/confect/editor/size";
import { paragraphOf } from "@repo/backend/test/editor/nodes";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Option } from "effect";
import { tryPrompt } from "@/components/tenant/exams/try/fold";

/** The snapshot of one paragraph of `a`, at version 1, as the editor opened it. */
const SNAPSHOT = { content: encodeJsonText(paragraphOf("a")), version: 1 };

/** A stored step that inserts `text` at position 2, which is the end of the text `a`. */
const insert = (version: number, text: string) => ({
  clientId: "rina",
  step: encodeJsonText({
    from: 2,
    slice: { content: [{ text, type: "text" }] },
    stepType: "replace",
    to: 2,
  }),
  version,
});

/** A document as the editor opened it, with the steps after its snapshot. */
const opened = (
  steps: readonly ReturnType<typeof insert>[],
  snapshot = SNAPSHOT
) => ({ client: null, snapshot, steps });

describe("exam try prompt", () => {
  it.effect(
    "applies the stored steps in order, and keys the prompt by its last step",
    () =>
      Effect.gen(function* () {
        const prompt = yield* tryPrompt(
          opened([insert(2, "b"), insert(3, "c")])
        );
        expect(prompt).toEqual(
          Option.some({ document: paragraphOf("acb"), key: 3 })
        );
      })
  );

  it.effect(
    "shows the snapshot itself, keyed by its version, when no step follows it",
    () =>
      Effect.gen(function* () {
        const prompt = yield* tryPrompt(opened([]));
        expect(prompt).toEqual(
          Option.some({ document: paragraphOf("a"), key: 1 })
        );
      })
  );

  it.effect("waits while a full page of steps may stop short of the head", () =>
    Effect.gen(function* () {
      const page = Arr.makeBy(STEP_PAGE_STEPS, (index) =>
        insert(index + 2, "b")
      );
      expect(yield* tryPrompt(opened(page))).toEqual(Option.none());
    })
  );

  it.effect(
    "shows the prompt once the page is one step short of a full page",
    () =>
      Effect.gen(function* () {
        const page = Arr.makeBy(STEP_PAGE_STEPS - 1, (index) =>
          insert(index + 2, "b")
        );
        expect(yield* tryPrompt(opened(page))).toEqual(
          Option.some({
            document: paragraphOf(`a${"b".repeat(STEP_PAGE_STEPS - 1)}`),
            key: STEP_PAGE_STEPS,
          })
        );
      })
  );

  it.effect("shows nothing when the snapshot does not fit the schema", () =>
    Effect.gen(function* () {
      const refused = {
        content: encodeJsonText({
          content: [{ type: "unknown" }],
          type: "doc",
        }),
        version: 1,
      };
      expect(yield* tryPrompt(opened([], refused))).toEqual(Option.none());
    })
  );
});
