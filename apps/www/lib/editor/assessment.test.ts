import { describe, expect, it } from "@effect/vitest";
import { storedDocument } from "@repo/backend/confect/editor/document";
import { foldSteps } from "@repo/backend/confect/editor/fold";
import { assessmentModel } from "@repo/backend/confect/editor/model";
import { NodeTypeSchema } from "@repo/backend/confect/editor/node";
import { StepSchema } from "@repo/backend/confect/editor/step";
import { encodeJsonText } from "@repo/utilities/json";
import { utf8Bytes } from "@repo/utilities/text";
import type { Transaction } from "@tiptap/pm/state";
import { EditorState } from "@tiptap/pm/state";
import { findWrapping, type Step } from "@tiptap/pm/transform";
import {
  Array as Arr,
  Effect,
  Record as Rec,
  Schema,
  String as Str,
} from "effect";
import {
  ASSESSMENT_MARKS,
  ASSESSMENT_RULES,
  assessmentSchema,
} from "@/lib/editor/assessment";

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

/** A document of one heading of `level`, as the editor writes it, as JSON text. */
const headingText = (level: number) =>
  encodeJsonText({
    content: [
      {
        attrs: { level },
        content: [{ text: "Judul", type: "text" }],
        type: "heading",
      },
    ],
    type: "doc",
  });

/** A document of one paragraph whose text links to `href`, as JSON text. */
const linkText = (href: string) =>
  encodeJsonText({
    content: [
      {
        content: [
          {
            marks: [{ attrs: { href }, type: "link" }],
            text: "a",
            type: "text",
          },
        ],
        type: "paragraph",
      },
    ],
    type: "doc",
  });

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

describe("editor/assessment server fold", () => {
  it.effect(
    "folds the steps of the editor's own commands on the server into the document the editor holds",
    () =>
      Effect.gen(function* () {
        const start = assessmentSchema.nodeFromJSON({
          content: [
            { content: [{ text: "Soal", type: "text" }], type: "paragraph" },
          ],
          type: "doc",
        });
        let state = EditorState.create({ doc: start });
        let steps: readonly Step[] = [];
        // Each change is one transaction of the editor, and its steps are the ones the
        // editor sends, so the server folds what the editor really makes.
        const commit = (change: (tr: Transaction) => void) => {
          const tr = state.tr;
          change(tr);
          steps = Arr.appendAll(steps, tr.steps);
          state = state.apply(tr);
        };
        commit((tr) =>
          tr.setBlockType(1, 5, assessmentSchema.nodes.heading, { level: 2 })
        );
        commit((tr) => tr.addMark(1, 3, assessmentSchema.marks.bold.create()));
        commit((tr) => tr.insertText("?", 1));
        commit((tr) => tr.insertText("!", 6));
        commit((tr) =>
          tr.addMark(
            2,
            4,
            assessmentSchema.marks.link.create({
              href: "https://nakafa.com",
            })
          )
        );
        commit((tr) => tr.removeMark(1, 3, assessmentSchema.marks.bold));
        commit((tr) => {
          const range = tr.doc.resolve(1).blockRange();
          const wrapping =
            range === null
              ? null
              : findWrapping(range, assessmentSchema.nodes.blockquote);
          if (range !== null && wrapping !== null) {
            tr.wrap(range, wrapping);
          }
        });
        commit((tr) =>
          tr.insert(
            tr.doc.content.size,
            assessmentSchema.nodes.paragraph.create(
              null,
              assessmentSchema.text("fin")
            )
          )
        );
        const decoded = yield* Effect.forEach(steps, (step) =>
          Schema.decodeUnknownEffect(StepSchema)(step.toJSON()).pipe(
            Effect.orDie
          )
        );
        const folded = yield* foldSteps(
          assessmentModel,
          assessmentModel.nodeFromJSON(start.toJSON()),
          0,
          decoded
        );
        expect(folded.skipped).toEqual([]);
        expect(folded.doc.toJSON()).toEqual(state.doc.toJSON());
      })
  );
});

describe("editor/assessment rules", () => {
  it("reads exactly the node types the server admits, with its document root", () => {
    expect(Arr.sort(Rec.keys(assessmentSchema.nodes), Str.Order)).toEqual(
      Arr.sort([...NodeTypeSchema.literals, "doc"], Str.Order)
    );
  });

  it.effect(
    "offers the heading levels the contract accepts at the snapshot, and no other",
    () =>
      Effect.gen(function* () {
        const accepted = yield* Effect.filter([1, 2, 3, 4, 5, 6], (level) =>
          storedDocument(headingText(level)).pipe(
            Effect.as(true),
            Effect.catchTag("DocumentInvalid", () => Effect.succeed(false))
          )
        );
        expect(ASSESSMENT_RULES.headingLevels).toEqual(accepted);
      })
  );

  it.effect(
    "measures a document as the snapshot stores it, so its JSON is as long as the stored text",
    () =>
      Effect.gen(function* () {
        const item = (text: string) =>
          assessmentSchema.node("listItem", null, [
            assessmentSchema.node("paragraph", null, [run(text, [])]),
          ]);
        const document = assessmentSchema.node("doc", null, [
          assessmentSchema.node("heading", { level: 2 }, [
            run("Judul", ["link"]),
          ]),
          assessmentSchema.node("paragraph", null, [
            run("Teks", ["bold", "link"]),
          ]),
          assessmentSchema.node("orderedList", { start: 3 }, [item("satu")]),
          assessmentSchema.node("bulletList", null, [item("dua")]),
          assessmentSchema.node("blockquote", null, [
            assessmentSchema.node("paragraph", null, [run("kutipan", [])]),
          ]),
          assessmentSchema.node("codeBlock", { language: null }, [
            assessmentSchema.text("kode"),
          ]),
        ]);
        const editorText = encodeJsonText(document.toJSON());
        const stored = yield* storedDocument(editorText);
        expect(utf8Bytes(editorText)).toBe(utf8Bytes(stored));
      })
  );

  it.effect(
    "takes a link only at an address the contract accepts, and refuses an http address at the snapshot",
    () =>
      Effect.gen(function* () {
        expect(ASSESSMENT_RULES.isLinkAllowed("https://nakafa.com")).toBe(true);
        expect(ASSESSMENT_RULES.isLinkAllowed("http://nakafa.com")).toBe(false);
        const refused = yield* storedDocument(
          linkText("http://nakafa.com")
        ).pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "DocumentInvalid" });
        yield* storedDocument(linkText("https://nakafa.com"));
      })
  );
});
