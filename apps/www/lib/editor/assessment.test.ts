import { describe, expect, it } from "@effect/vitest";
import { storedDocument } from "@repo/backend/confect/editor/document";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Record as Rec } from "effect";
import { ASSESSMENT_MARKS, assessmentSchema } from "@/lib/editor/assessment";

/** The marks of an assessment document in the order the contract writes them (ADR 0031). */
const CONTRACT_ORDER = [
  "bold",
  "italic",
  "underline",
  "code",
  "subscript",
  "superscript",
  "link",
];

/** A text run of an assessment document with the marks named, a link taking its address. */
const run = (
  text: string,
  names: readonly (typeof ASSESSMENT_MARKS)[number][]
) =>
  assessmentSchema.text(
    text,
    Arr.map(names, (name) =>
      assessmentSchema.marks[name].create(
        name === "link" ? { href: "https://nakafa.com" } : null
      )
    )
  );

describe("editor/assessment marks", () => {
  it("offers the contract's marks, in the contract's order, and the schema holds exactly them", () => {
    expect(ASSESSMENT_MARKS).toEqual(CONTRACT_ORDER);
    expect(Rec.keys(assessmentSchema.marks)).toEqual(CONTRACT_ORDER);
  });

  it.effect(
    "stores at the snapshot a document that uses every mark of the contract",
    () =>
      Effect.gen(function* () {
        const doc = assessmentSchema.node("doc", null, [
          assessmentSchema.node("paragraph", null, [
            run("a", ASSESSMENT_MARKS),
            run("b", ["bold"]),
            run("c", ["subscript", "superscript"]),
          ]),
        ]);
        const text = encodeJsonText(doc.toJSON());
        // The snapshot refuses any document the contract refuses, so a stored text is one it accepts,
        // and it keeps every mark the document used.
        const stored = yield* storedDocument(text);
        for (const name of ASSESSMENT_MARKS) {
          expect(stored).toContain(`"type":"${name}"`);
        }
      })
  );

  it.effect(
    "refuses a text whose link comes before its bold, the order the schema never writes",
    () =>
      Effect.gen(function* () {
        const text = encodeJsonText({
          content: [
            {
              content: [
                {
                  marks: [
                    { attrs: { href: "https://nakafa.com" }, type: "link" },
                    { type: "bold" },
                  ],
                  text: "a",
                  type: "text",
                },
              ],
              type: "paragraph",
            },
          ],
          type: "doc",
        });
        const failure = yield* storedDocument(text).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "DocumentInvalid" });
      })
  );
});
