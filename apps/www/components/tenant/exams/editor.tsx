"use client";

import { QueryResult, useQuery } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "next-intl";
import { useConvexAuth } from "@/components/providers/convex";
import { ExamCanvas } from "@/components/tenant/exams/canvas";
import { ExamHeader } from "@/components/tenant/exams/header";
import { ExamProvider } from "@/components/tenant/exams/provider";
import { ExamStrip } from "@/components/tenant/exams/strip";

/**
 * The editor of one exam: its title in a header, the strip of questions beside the
 * canvas of the selected one, and, on a phone, the strip above the canvas. The editor
 * fills the viewport as the page's main landmark, because the school sidebar steps
 * aside on its route; an exam that cannot be read says so and links back to the list.
 * The exam is read once here, and the parts read it through the provider.
 */
export function ExamEditor({
  examId,
  slug,
}: {
  examId: Id<"exams">;
  slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  // The exam needs the session, which Convex learns a moment after the page draws.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const result = useQuery(
    exams.exams.open,
    isSettled ? { examId, slug } : "skip"
  );

  if (QueryResult.isFailure(result)) {
    return (
      <main className="flex h-svh flex-col items-center justify-center gap-4 p-4">
        <p className="max-w-xs text-center text-sm">{t("unavailable")}</p>
        <NavigationLink
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href="/exams"
        >
          {t("title")}
        </NavigationLink>
      </main>
    );
  }

  if (!QueryResult.isSuccess(result)) {
    return null;
  }

  return (
    <ExamProvider exam={result.value} slug={slug}>
      <main className="flex h-svh flex-col">
        <ExamHeader />
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <ExamStrip />
          <ExamCanvas />
        </div>
      </main>
    </ExamProvider>
  );
}
