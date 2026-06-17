import type { ReactNode } from "react";
import { resolveMaterialRoute } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { ContentViewTracker } from "@/components/tracking/tracker";
import { getRuntimeContentViewId } from "@/lib/content/views";

type MaterialLayoutParams =
  PageProps<"/[locale]/materials/[subject]/[topic]/[[...lesson]]">["params"];

/**
 * Restores material content view tracking for canonical lesson pages.
 *
 * The tracker reads the generated public route row while MDX rendering still
 * uses the source path. Topic hubs remain navigation pages and do not emit a
 * lesson-body content view.
 */
export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: MaterialLayoutParams;
}) {
  const { locale, route } = await resolveMaterialRoute(params);

  if (route.kind !== "subject-lesson") {
    return children;
  }

  const contentId = await getRuntimeContentViewId({
    locale,
    route: route.publicPath,
  });

  if (!contentId) {
    return children;
  }

  return (
    <ContentViewTracker contentId={contentId} locale={locale}>
      {children}
    </ContentViewTracker>
  );
}
