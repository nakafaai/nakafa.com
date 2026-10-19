"use client";

import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { useSessionSettled } from "@/components/exams/results/context";
import { verdictKeys } from "@/components/exams/results/model";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";

/**
 * The student's own result under the sentence of a submitted attempt. Until the teacher releases the
 * results, the card says when they come. After the release it shows the score and the verdict of each
 * question, and no key or explanation.
 */
export function StudentResults({
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
  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("student-results-title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <p className="font-medium">
          {t("student-score", { points, total: questions.length })}
        </p>
        <ul aria-label={t("student-answers")} className="grid gap-2">
          {Arr.map(questions, (question) => (
            <li className="flex justify-between gap-4" key={question.number}>
              <span>{t("question", { number: question.number })}</span>
              <span>{t(verdictKeys[question.verdict])}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardSectionFooter hint={t("student-results-released")} />
    </CardSection>
  );
}
