import { describe, expect, it } from "@effect/vitest";
import { ExamView } from "@repo/backend/confect/exams/exam";
import de from "@repo/internationalization/dictionaries/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import id from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import ms from "@repo/internationalization/dictionaries/ms.json" with {
  type: "json",
};
import { Array as Arr, Record as Rec, Schema } from "effect";
import { demoExam } from "@/components/marketing/school/editor/exam";

/** The demo's sentences in one language, as the landing reads them from the dictionary. */
const textsOf = ({ Common: common, SchoolSite: site }: typeof en) => ({
  answer: common.answer,
  essay: site["demo-exam-essay"],
  explanation: site["demo-exam-explanation"],
  numeric: site["demo-exam-numeric"],
  question: site["demo-exam-question"],
  rubric: site["demo-exam-rubric"],
  title: site["demo-exam-title"],
});

/** A stored document's JSON text, read back as data. */
const DocumentText = Schema.fromJsonString(
  Schema.Struct({
    content: Schema.Array(
      Schema.Struct({
        content: Schema.optionalKey(
          Schema.Array(
            Schema.Struct({
              attrs: Schema.optionalKey(
                Schema.Struct({ latex: Schema.String })
              ),
              text: Schema.optionalKey(Schema.String),
              type: Schema.String,
            })
          )
        ),
        type: Schema.String,
      })
    ),
    type: Schema.Literal("doc"),
  })
);

/** The inline nodes of a stored document's one paragraph. */
const inlineOf = (text: string) =>
  Arr.flatMap(
    Schema.decodeSync(DocumentText)(text).content,
    (block) => block.content ?? []
  );

describe("the School landing's demo exam", () => {
  it.each([
    ["de", de],
    ["en", en],
    ["id", id],
    ["ms", ms],
  ] as const)(
    "is an exam the server would hold, with its formulas drawn as math, in %s",
    (_locale, dictionary) => {
      const { documents, exam } = demoExam(textsOf(dictionary));

      expect(Schema.is(Schema.toEncoded(ExamView))(exam)).toBe(true);
      expect(Arr.map(exam.questions, (question) => question.template)).toEqual([
        "choice",
        "numeric",
        "essay",
      ]);
      const prompt = inlineOf(documents.seedprompt1);
      expect(
        Arr.filter(prompt, (node) => node.type === "mathInline")
      ).toHaveLength(2);
      expect(Arr.every(prompt, (node) => node.text !== "")).toBe(true);
      expect(
        Arr.filter(
          inlineOf(documents.seedprompt2),
          (node) => node.type === "mathInline"
        )
      ).toHaveLength(3);
      expect(inlineOf(documents.seedexplanation2)).toEqual([
        {
          attrs: {
            latex: "p = 4 \\cdot 2.5 = 10\\ \\text{kg}\\cdot\\text{m/s}",
          },
          type: "mathInline",
        },
      ]);
      expect(Rec.keys(documents)).toHaveLength(9);
    }
  );

  it("draws an empty text as one empty paragraph, and draws nothing for a formula it does not know", () => {
    const { documents } = demoExam({
      ...textsOf(en),
      essay: "Explain <unknown></unknown>.",
    });

    expect(inlineOf(documents.seedrubric1)).toEqual([]);
    expect(inlineOf(documents.seedprompt3)).toEqual([
      { text: "Explain ", type: "text" },
      { text: ".", type: "text" },
    ]);
  });
});
