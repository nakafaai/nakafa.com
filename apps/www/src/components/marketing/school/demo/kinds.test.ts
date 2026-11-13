import { describe, expect, it } from "@effect/vitest";
import { ExamView } from "@repo/backend/confect/exams/exam";
import { QuestionTemplate } from "@repo/backend/confect/exams/question";
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
import { paperExam } from "@/components/marketing/school/demo/kinds";

/** The paper's texts in one language, as the landing reads them from the dictionary. */
const textsOf = ({ Exams: exams, SchoolSite: site }: typeof en) => ({
  answer: site["demo-exam-answer"],
  cause: site["paper-cause"],
  causes: [
    exams["cause-related"],
    exams["cause-unrelated"],
    exams["cause-reason-false"],
    exams["cause-statement-false"],
    exams["cause-both-false"],
  ] as const,
  choice: site["demo-exam-question"],
  choices: site["paper-choices"],
  essay: site["demo-exam-essay"],
  mass: site["paper-mass"],
  match: site["paper-match"],
  momentum: site["paper-momentum"],
  numeric: site["demo-exam-numeric"],
  reason: site["paper-reason"],
  reasons: {
    answers: [site["paper-reason-cart"], site["paper-reason-ball"]] as const,
    why: [site["paper-reason-heavier"], site["paper-reason-faster"]] as const,
  },
  short: site["paper-short"],
  statements: [
    site["paper-table-heavier"],
    site["paper-table-joules"],
    site["paper-table-rest"],
  ] as const,
  table: site["paper-table"],
  time: site["paper-time"],
  title: site["demo-exam-title"],
  truefalse: site["paper-truefalse"],
  truth: [exams["truefalse-true"], exams["truefalse-false"]] as const,
  velocity: site["paper-velocity"],
});

/** A stored document's JSON text, read back as the kinds of its inline nodes. */
const DocumentText = Schema.fromJsonString(
  Schema.Struct({
    content: Schema.Array(
      Schema.Struct({
        content: Schema.optionalKey(
          Schema.Array(Schema.Struct({ type: Schema.String }))
        ),
      })
    ),
  })
);

/** The kinds of the inline nodes of a stored document. */
const kindsOf = (text: string) =>
  Arr.flatMap(Schema.decodeSync(DocumentText)(text).content, (block) =>
    Arr.map(block.content ?? [], (node) => node.type)
  );

describe("the School landing's paper of every type", () => {
  it.each([
    ["de", de],
    ["en", en],
    ["id", id],
    ["ms", ms],
  ] as const)(
    "is an exam the server would hold, one question of each type in the menu's order, in %s",
    (_locale, dictionary) => {
      const { documents, exam } = paperExam(textsOf(dictionary));

      expect(Schema.is(Schema.toEncoded(ExamView))(exam)).toBe(true);
      expect(Arr.map(exam.questions, (question) => question.id)).toEqual(
        QuestionTemplate.literals
      );
      expect(
        Arr.every(
          exam.questions,
          (question) => question.id === question.template
        )
      ).toBe(true);
      // Every question's prompt has its words, and a prompt that names formulas draws them as math.
      expect(Rec.keys(documents)).toHaveLength(30);
      expect(
        Arr.contains(kindsOf(documents.reasonprompt ?? ""), "mathInline")
      ).toBe(true);
      expect(kindsOf(documents.shortprompt ?? "")).toEqual(["text"]);
      expect(kindsOf(documents.essayrubric ?? "")).toEqual([]);
    }
  );
});
