import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { StudentResult } from "@repo/backend/confect/exams/results/contract";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Array as Arr, Number as Num } from "effect";
import { useTranslations } from "use-intl";
import { useSessionSettled } from "@/components/exams/results/context";
import { responseLetters, verdictKeys } from "@/components/exams/results/model";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { ReadBoundary } from "@/components/tenant/read/boundary";

/** The letters of the options that a student chose, or a line that says the question was left unanswered. */
function AnswerLine({
  optionIds,
  response,
}: {
  readonly optionIds: readonly string[];
  readonly response: readonly string[];
}) {
  const t = useTranslations("Exams");
  const letters = responseLetters(optionIds, response);
  if (letters.length === 0) {
    return t("student-no-answer");
  }
  return t("student-answer", { letters: Arr.join(letters, ", ") });
}

/** One question of the student's result: its number and verdict, with the answer that the student chose beneath. */
function AnswerItem({
  question,
}: {
  readonly question: (typeof StudentResult.Type)["questions"][number];
}) {
  const t = useTranslations("Exams");

  return (
    <li className="grid gap-1">
      <div className="flex justify-between gap-4">
        <span>{t("question", { number: question.number })}</span>
        <span>{t(verdictKeys[question.verdict])}</span>
      </div>
      <span className="text-muted-foreground">
        <AnswerLine
          optionIds={question.optionIds}
          response={question.response}
        />
      </span>
    </li>
  );
}

/**
 * The student's own result under the sentence of a submitted attempt. Until the teacher releases the
 * results, the card says when they come. After the release it shows the score, and each question with the
 * answer that the student chose and its verdict, and no key or explanation.
 */
export function StudentResults({
  sittingId,
  slug,
}: {
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");

  return (
    <ReadBoundary
      fallback={(failure) => (
        <CardSection>
          <CardHeader>
            <CardTitle>{t("student-results-title")}</CardTitle>
          </CardHeader>
          <CardContent>{failure}</CardContent>
          <CardSectionFooter hint={t("student-results-footer")} />
        </CardSection>
      )}
      read={{ args: { sittingId, slug }, ref: exams.results.results.mine }}
    >
      <StudentResultsContent sittingId={sittingId} slug={slug} />
    </ReadBoundary>
  );
}

/** The student's own result once it is in: the card of a submitted attempt, or nothing while it loads. */
function StudentResultsContent({
  sittingId,
  slug,
}: {
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const settled = useSessionSettled();
  const result = useQuery(
    exams.results.results.mine,
    settled ? { sittingId, slug } : "skip"
  );

  if (QueryResult.isFailure(result)) {
    throw result.error;
  }
  if (!QueryResult.isSuccess(result)) {
    return null;
  }
  if (result.value === null) {
    return (
      <CardSection>
        <CardHeader>
          <CardTitle>{t("student-results-title")}</CardTitle>
        </CardHeader>
        <CardSectionFooter hint={t("student-results-footer")} />
      </CardSection>
    );
  }
  const { points, questions } = result.value;
  const total = Num.sumAll(Arr.map(questions, (question) => question.points));
  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("student-results-title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <p className="font-medium">{t("student-score", { points, total })}</p>
        <ul aria-label={t("student-answers")} className="grid gap-3">
          {Arr.map(questions, (question) => (
            <AnswerItem key={question.number} question={question} />
          ))}
        </ul>
      </CardContent>
      <CardSectionFooter hint={t("student-results-released")} />
    </CardSection>
  );
}
