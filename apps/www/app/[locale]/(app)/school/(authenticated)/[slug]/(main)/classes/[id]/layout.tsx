import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SchoolClassesForumPostSheet } from "@/components/school/classes/forum/post-sheet";
import { SchoolClassesHeaderInfo } from "@/components/school/classes/info";
import { SchoolClassesTabs } from "@/components/school/classes/tabs";
import { SchoolClassesValidation } from "@/components/school/classes/validation";
import { SchoolNotFound } from "@/components/school/not-found";
import { ClassContextProvider } from "@/lib/context/use-class";
import { ForumContextProvider } from "@/lib/context/use-forum";

export default function Layout(
  props: LayoutProps<"/[locale]/school/[slug]/classes/[id]">
) {
  const { children, params } = props;
  const { locale, id } = use(params);
  if (!hasLocale(routing.locales, locale)) {
    // Ensure that the incoming `locale` is valid
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  const classId = id as Id<"schoolClasses">;

  return (
    <ErrorBoundary fallback={<SchoolNotFound />}>
      <SchoolClassesValidation classId={classId}>
        <ClassContextProvider classId={classId}>
          <SchoolClassesHeaderInfo />
          <SchoolClassesTabs />

          <ForumContextProvider classId={classId}>
            <SchoolClassesForumPostSheet />
            {children}
          </ForumContextProvider>
        </ClassContextProvider>
      </SchoolClassesValidation>
    </ErrorBoundary>
  );
}
