import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { compareResultValidator } from "@repo/backend/confect/contents/sections/compare.spec";
import type { EmbeddingModelId } from "@repo/backend/confect/gateway/model";
import type { questionsFor } from "@repo/backend/scripts/knowledge/questions";
import { Array as Arr, Number as Num, Option, Result } from "effect";

/** The rank within which the right section counts as found. */
const TOP = 5;

type Question = ReturnType<typeof questionsFor>[number];
type Ranked = Extract<typeof compareResultValidator.Type, { kind: "ranked" }>;

/** `part` divided by `whole`, and zero when there is nothing to divide by. */
function quotient(part: number, whole: number) {
  return Option.getOrElse(Num.divide(part, whole), () => 0);
}

/**
 * Judges one question: it counts, with the rank of its section, when the
 * stored section is the one it was labeled with, and it is left out, with the
 * reason, when the label no longer fits the index.
 */
function judged(question: Question, verdict: Ranked["verdicts"][number]) {
  const { section } = verdict;
  if (section === null) {
    return Result.fail({
      question: question.question,
      why: "no such section is stored",
    });
  }
  if (section.heading !== question.heading) {
    return Result.fail({
      question: question.question,
      why: `the stored heading is "${section.heading}"`,
    });
  }
  return Result.succeed(section.rank);
}

/**
 * What one candidate model found in one language: how many of the questions
 * that count had their section within the top five, how long it took to embed
 * a question, and how many sections it embedded (`pool`) and refused
 * (`refused`). A question about a section that the model refused counts, and
 * counts as missed, because a build with that model would leave the section
 * out of the index.
 */
export function summarize(
  model: EmbeddingModelId,
  locale: ActiveAppLocaleCode,
  questions: readonly Question[],
  ranked: Ranked
) {
  const [ranks, skipped] = Arr.separate(
    Arr.zipWith(questions, ranked.verdicts, judged)
  );
  const top = Arr.length(Arr.filter(ranks, (rank) => rank <= TOP));
  const times = Arr.map(ranked.verdicts, ({ milliseconds }) => milliseconds);
  return {
    counted: Arr.length(ranks),
    locale,
    maxMs: Num.round(Arr.reduce(times, 0, Num.max), 0),
    meanMs: Num.round(quotient(Num.sumAll(times), Arr.length(times)), 0),
    model,
    pool: ranked.pool,
    refused: ranked.refused,
    skipped,
    top5: top,
    top5Share: Num.round(quotient(top, Arr.length(ranks)), 3),
  };
}
