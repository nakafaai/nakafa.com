"use client";

import { QueryResult, useQuery } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { useTranslations } from "next-intl";
import { ExamCanvas } from "@/components/tenant/exams/canvas";
import { ExamHeader } from "@/components/tenant/exams/header";
import { ExamProvider } from "@/components/tenant/exams/provider";
import { ExamStrip } from "@/components/tenant/exams/strip";

/**
 * The editor of one exam: its title in a header, the strip of questions beside the
 * canvas of the selected one, and, on a phone, the strip above the canvas. The editor
 * fills the viewport, because the school sidebar steps aside on its route. The exam
 * is read once here, and the parts read it through the provider.
 */
export function ExamEditor({
  examId,
  slug,
}: {
  examId: Id<"exams">;
  slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const result = useQuery(exams.exams.open, { examId, slug });

  if (QueryResult.isFailure(result)) {
    return <p className="p-4 text-sm">{t("unavailable")}</p>;
  }

  if (!QueryResult.isSuccess(result)) {
    return null;
  }

  return (
    <ExamProvider exam={result.value} slug={slug}>
      <div className="flex h-svh flex-col">
        <ExamHeader />
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <ExamStrip />
          <ExamCanvas />
        </div>
      </div>
    </ExamProvider>
  );
}
