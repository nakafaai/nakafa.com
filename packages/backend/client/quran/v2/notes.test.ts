import {
  parseQuranTranslation,
  QuranTranslationNotesError,
} from "@nakafa/aksara-contracts/quran/notes";
import {
  projectQuranTranslationV2,
  renderQuranTranslationMarkdownV2,
} from "@repo/backend/client/quran/v2/notes";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

describe("Quran translation notes", () => {
  it.live("preserves translations without source notes", () =>
    Effect.gen(function* () {
      expect(
        yield* parseQuranTranslation({
          footnotes: "",
          text: "Im Namen Allahs.",
        })
      ).toEqual({
        notes: [],
        segments: [{ kind: "text", offset: 0, value: "Im Namen Allahs." }],
      });
    })
  );

  it.live("links one marker while preserving its exact punctuation", () =>
    Effect.gen(function* () {
      expect(
        yield* parseQuranTranslation({
          footnotes: "[4] Catatan sumber.",
          text: "Alif Lām Mīm.[4]",
        })
      ).toEqual({
        notes: [{ number: 4, referenceOffset: 13, text: "Catatan sumber." }],
        segments: [
          { kind: "text", offset: 0, value: "Alif Lām Mīm." },
          { kind: "note", number: 4, offset: 13 },
        ],
      });
    })
  );

  it.live("projects explicit agent labels and exact note definitions", () =>
    Effect.gen(function* () {
      const translation = yield* parseQuranTranslation({
        footnotes: "[4] Catatan sumber.",
        text: "Alif Lām Mīm.[4]",
      });

      expect(projectQuranTranslationV2(translation)).toEqual({
        notes: [{ number: 4, text: "Catatan sumber." }],
        text: "Alif Lām Mīm.[translation note 4]",
      });
      expect(renderQuranTranslationMarkdownV2(translation)).toEqual([
        "Translation: Alif Lām Mīm.[translation note 4]",
        "",
        "Translation notes:",
        "- 4. Catatan sumber.",
      ]);
    })
  );

  it.live("keeps editorial brackets and splits multiple source notes", () =>
    Effect.gen(function* () {
      expect(
        yield* parseQuranTranslation({
          footnotes: "[3] First note. [4] Second note.",
          text: "those [pilgrims] who pray[3] and give what We[4] provided",
        })
      ).toMatchObject({
        notes: [
          { number: 3, text: "First note." },
          { number: 4, text: "Second note." },
        ],
        segments: [
          { kind: "text", value: "those [pilgrims] who pray" },
          { kind: "note", number: 3 },
          { kind: "text", value: " and give what We" },
          { kind: "note", number: 4 },
          { kind: "text", value: " provided" },
        ],
      });
    })
  );

  it.live("supports repeated references to one exact note", () =>
    Effect.gen(function* () {
      expect(
        yield* parseQuranTranslation({
          footnotes: "[1] Shared source note.",
          text: "[1]First reference and second[1]",
        })
      ).toMatchObject({
        notes: [{ number: 1, text: "Shared source note." }],
        segments: [
          { kind: "note", number: 1 },
          { kind: "text", value: "First reference and second" },
          { kind: "note", number: 1 },
        ],
      });
    })
  );

  it.live("fails closed when markers and definitions diverge", () =>
    Effect.gen(function* () {
      const missing = yield* Effect.result(
        parseQuranTranslation({ footnotes: "", text: "Translation[1]." })
      );
      const orphaned = yield* Effect.result(
        parseQuranTranslation({
          footnotes: "[1] Source note.",
          text: "Translation.",
        })
      );
      const duplicate = yield* Effect.result(
        parseQuranTranslation({
          footnotes: "[1] First. [1] Duplicate.",
          text: "Translation[1].",
        })
      );
      const reordered = yield* Effect.result(
        parseQuranTranslation({
          footnotes: "[2] Second. [1] First.",
          text: "First[1], second[2].",
        })
      );
      const prefixed = yield* Effect.result(
        parseQuranTranslation({
          footnotes: "Unexpected [1] Source note.",
          text: "Translation[1].",
        })
      );

      for (const result of [
        missing,
        orphaned,
        duplicate,
        reordered,
        prefixed,
      ]) {
        expect(result).toEqual(
          expect.objectContaining({
            _tag: "Failure",
            failure: new QuranTranslationNotesError({
              reason: "mismatched-markers",
            }),
          })
        );
      }
    })
  );

  it.live("rejects invalid numbers and empty definitions", () =>
    Effect.gen(function* () {
      const leadingZero = yield* Effect.result(
        parseQuranTranslation({
          footnotes: "[01] Source note.",
          text: "Translation[01].",
        })
      );
      const zero = yield* Effect.result(
        parseQuranTranslation({
          footnotes: "[0] Source note.",
          text: "Translation[0].",
        })
      );
      const empty = yield* Effect.result(
        parseQuranTranslation({ footnotes: "[1]", text: "Translation[1]" })
      );

      expect(leadingZero).toMatchObject({
        _tag: "Failure",
        failure: { reason: "invalid-marker" },
      });
      expect(zero).toMatchObject({
        _tag: "Failure",
        failure: { reason: "invalid-marker" },
      });
      expect(empty).toMatchObject({
        _tag: "Failure",
        failure: { reason: "empty-note" },
      });
    })
  );
});
