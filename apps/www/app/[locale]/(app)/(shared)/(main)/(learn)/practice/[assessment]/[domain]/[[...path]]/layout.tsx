import type { Locale } from "next-intl";
import type { ReactNode } from "react";
import { getPracticeRuntimeSetPath } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/data";
import { ContentViewTracker } from "@/components/tracking/tracker";
import { getRuntimeContentViewId } from "@/lib/content/views";
import { AttemptContextProvider } from "@/lib/context/use-attempt";
import { ExerciseContextProvider } from "@/lib/context/use-exercise";

type PracticeLayoutProps =
  PageProps<"/[locale]/practice/[assessment]/[domain]/[[...path]]"> & {
    children: ReactNode;
  };

/**
 * Wraps restored practice pages with attempt context and content tracking.
 *
 * Source set slugs remain the attempt identity, while projected route paths are
 * used for content-view lookup. Domain pages do not create a concrete exercise
 * attempt context.
 */
export default async function Layout({
  children,
  params,
}: PracticeLayoutProps) {
  const runtime = await getPracticeRuntimeSetPath(params);
  const content = runtime.setPath ? (
    <PracticeRuntimeProviders locale={runtime.locale} slug={runtime.setPath}>
      {children}
    </PracticeRuntimeProviders>
  ) : (
    children
  );

  if (!runtime.routePath) {
    return content;
  }

  const contentId = await getRuntimeContentViewId({
    locale: runtime.locale,
    route: runtime.routePath,
  });

  if (!contentId) {
    return content;
  }

  return (
    <ContentViewTracker contentId={contentId} locale={runtime.locale}>
      {content}
    </ContentViewTracker>
  );
}

/** Provides the exercise attempt stores required by restored practice controls. */
function PracticeRuntimeProviders({
  children,
  locale,
  slug,
}: {
  children: ReactNode;
  locale: Locale;
  slug: string;
}) {
  return (
    <ExerciseContextProvider key={slug} slug={slug}>
      <AttemptContextProvider locale={locale} slug={slug}>
        {children}
      </AttemptContextProvider>
    </ExerciseContextProvider>
  );
}
