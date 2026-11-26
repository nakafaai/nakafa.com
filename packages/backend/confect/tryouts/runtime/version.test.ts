import { describe, expect, it } from "@effect/vitest";
import { ContentLanguageSchema } from "@nakafa/aksara-contracts/locale";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { placeVersion } from "@repo/backend/confect/tryouts/runtime/version";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Option, Schema } from "effect";

const language = Schema.decodeSync(ContentLanguageSchema);

/** The first text of a fixture document. */
const FIRST_TEXT = /"text":"(?<text>[^"]+)"/u;

/** A document as its JSON text. */
const encodeText = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** The text of a fixture document's first paragraph. */
const textOf = (document: unknown) =>
  encodeText(document).match(FIRST_TEXT)?.groups?.text ?? "";

/** Reads the first place of one section of an attempt, as the runtime stores it. */
const readPlace = (attemptId: Id<"tryoutAttempts">, sectionKey: string) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader
      .table("tryoutAttemptPlacements")
      .index("by_tryoutAttemptId_and_sectionKey_and_questionOrder", (query) =>
        query.eq("tryoutAttemptId", attemptId).eq("sectionKey", sectionKey)
      )
      .first()
      .pipe(Effect.orDie, Effect.flatMap(Effect.fromOption), Effect.orDie)
  );

describe("tryouts/runtime/placeVersion", () => {
  it.effect(
    "reads a place in each language of its section: its own prompt, option labels, and reading",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ languages: ["ms", "en"] });
        const { attemptId } = yield* world.start();
        const read = yield* world.run(
          Effect.gen(function* () {
            const table = yield* readPlace(attemptId, "section-b");
            const malay = yield* placeVersion(
              world.snapshotId,
              table,
              language("ms")
            );
            const english = yield* placeVersion(
              world.snapshotId,
              table,
              language("en")
            );
            const [interaction] = english.interactions;
            const column =
              interaction.kind === "matrix"
                ? interaction.columns[0]?.label
                : undefined;
            return {
              hashes: [malay.hash, english.hash],
              placed: Arr.map(table.versions, ({ hash }) => hash),
              prompts: [textOf(malay.prompt), textOf(english.prompt)],
              readings: [
                Option.match(malay.stimulus, {
                  onNone: () => "",
                  onSome: textOf,
                }),
                Option.match(english.stimulus, {
                  onNone: () => "",
                  onSome: textOf,
                }),
              ],
              column: textOf(column),
            };
          })
        );
        expect(read.hashes).toEqual(read.placed);
        expect(read).toMatchObject({
          column: "Benar (en)",
          prompts: ["Soal section-b-item-1 (ms)", "Soal section-b-item-1 (en)"],
          readings: ["Bacaan bersama (ms)", "Bacaan bersama (en)"],
        });
      })
  );

  it.effect(
    "refuses a language the place holds no version in, and reads a place without a reading as none",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ languages: ["ms", "en"] });
        const { attemptId } = yield* world.start();
        const read = yield* world.run(
          Effect.gen(function* () {
            const choice = yield* readPlace(attemptId, "section-a");
            const malay = yield* placeVersion(
              world.snapshotId,
              choice,
              language("ms")
            );
            const refused = yield* placeVersion(
              world.snapshotId,
              choice,
              language("de")
            ).pipe(Effect.flip);
            return {
              code: refused.code,
              reading: Option.isNone(malay.stimulus),
            };
          })
        );
        expect(read).toEqual({
          code: "TRYOUT_QUESTION_LANGUAGE_UNAVAILABLE",
          reading: true,
        });
      })
  );
});
