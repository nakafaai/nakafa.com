import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect } from "effect";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  readMaterialMetadata,
  readMaterialPage,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/content";
import { toMaterialMetadataCopy } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/metadata";
import { toMaterialHref } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/navigation";
import { MaterialShell } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/shell";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { readPublishedMaterialPrerenderRoute } from "@/lib/content/material/prerender";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import { readMaterialPreviewStaticParams } from "@/lib/content/preview/route";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createResolvedRouteAlternates } from "@/lib/seo/alternates";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";

type MaterialPageProps =
  PageProps<"/[locale]/materials/[subject]/[topic]/[[...lesson]]">;

/** Supplies the one real lesson per locale required by Cache Components. */
export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  const locale = getLocaleOrThrow(params.locale);
  if (hasPreviewConfig()) {
    return await readMaterialPreviewStaticParams(AppLocaleSchema.make(locale));
  }
  const route = await Effect.runPromise(
    readPublishedMaterialPrerenderRoute(locale)
  );
  const [, subject, topic, ...lesson] = route.publicPath.split("/");
  return [{ lesson, subject, topic }];
}

/**
 * Generates SEO metadata for canonical material topic and lesson pages.
 *
 * Public route rows own the localized path, while the runtime row owns the
 * richer authored metadata when the route is a concrete lesson body.
 */
export async function generateMetadata({
  params,
}: MaterialPageProps): Promise<Metadata> {
  const source = await readMaterialMetadata(params);
  const { appLocale, metadata, route } = source;
  const path = toMaterialHref(route);
  const { description, title } = toMaterialMetadataCopy(source);

  return {
    title: { absolute: title },
    description,
    authors: metadata?.authors.map(({ name }) => ({ name })),
    alternates: createResolvedRouteAlternates(route, source.alternates, {
      types: { "text/markdown": `${path}.md` },
    }),
    ...getSocialMetadata({
      title,
      description,
      locale: appLocale,
      path,
      image: getOgUrl(appLocale, route.publicPath),
      type: "article",
    }),
  };
}

/**
 * Renders the canonical material lesson page.
 *
 * Topic rows are grouping data for curriculum card pages. They intentionally
 * do not render public pages, so the learner opens concrete material content
 * directly from a collapsible card.
 */
export default function Page(props: MaterialPageProps) {
  return (
    <LayoutMaterial>
      <Suspense fallback={null}>
        <MaterialRouteContent {...props} />
      </Suspense>
    </LayoutMaterial>
  );
}

/** Reads only route-owned content so the complete lesson can be prerendered. */
async function MaterialRouteContent({ params }: MaterialPageProps) {
  const page = await readMaterialPage(params);
  return <MaterialShell page={page} />;
}
