import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect, Option, Schema } from "effect";
import type { Metadata } from "next";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  getPublishedPageCatalog,
  verifyPublishedPageCatalog,
} from "@/lib/content/page/catalog";
import {
  type PagePreviewInput,
  readPagePreview,
} from "@/lib/content/page/preview";
import {
  getCurrentPublishedPage,
  renderCurrentPublishedPage,
} from "@/lib/content/page/published";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import { readPagePreviewStaticParams } from "@/lib/content/preview/route";
import { getActiveLocaleOrThrow } from "@/lib/i18n/params";
import { createResolvedRouteAlternates } from "@/lib/utils/seo/alternates";

type PublicPageProps = PageProps<"/[locale]/[...page]">;

/** Validates the locale and complete Page route before runtime access. */
async function resolvePageParams(params: PublicPageProps["params"]) {
  const { locale: rawLocale, page } = await params;
  const locale = getActiveLocaleOrThrow(rawLocale);
  const publicPath = page.join("/");
  if (!Schema.is(PublicPathSchema)(publicPath)) {
    notFound();
  }
  return {
    appLocale: AppLocaleSchema.make(locale),
    publicPath: PublicPathSchema.make(publicPath),
  };
}

/** Reads local preview ownership without starting Effect during prerendering. */
async function readPagePreviewContent(input: PagePreviewInput) {
  if (!hasPreviewConfig()) {
    return Option.none();
  }

  await io();
  return Effect.runPromise(readPagePreview(input));
}

/** Prebuilds every locale-owned route from the signed Page catalog. */
export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  const locale = getActiveLocaleOrThrow(params.locale);
  if (hasPreviewConfig()) {
    const preview = await readPagePreviewStaticParams(
      AppLocaleSchema.make(locale)
    );
    return [preview];
  }
  const catalog = await getPublishedPageCatalog();
  const routes: { page: string[] }[] = [];
  for (const projection of catalog.projections) {
    if (projection.appLocale !== locale) {
      continue;
    }
    routes.push({ page: projection.publicPath.split("/") });
  }
  return routes;
}

/** Builds Page metadata and alternates from one pinned signed release. */
export async function generateMetadata({
  params,
}: PublicPageProps): Promise<Metadata> {
  const input = await resolvePageParams(params);
  const preview = await readPagePreviewContent(input);
  if (Option.isSome(preview)) {
    const page = preview.value.projection;
    const path = `/${page.appLocale}/${page.publicPath}`;
    return {
      title: { absolute: page.metadata.title },
      description: page.metadata.description,
      alternates: createResolvedRouteAlternates(page, [page], {
        types: { "text/markdown": `${path}.md` },
      }),
    };
  }
  const [page, catalog] = await Promise.all([
    getCurrentPublishedPage(input),
    getPublishedPageCatalog(),
  ]);
  if (!page) {
    notFound();
  }
  const counterparts = await Effect.runPromise(
    verifyPublishedPageCatalog(catalog, page)
  );
  const path = `/${page.projection.appLocale}/${page.projection.publicPath}`;
  return {
    title: { absolute: page.projection.metadata.title },
    description: page.projection.metadata.description,
    alternates: createResolvedRouteAlternates(page.projection, counterparts, {
      types: { "text/markdown": `${path}.md` },
    }),
  };
}

/** Streams one authenticated reviewed Page body through the site shell. */
export default function Page({ params }: PublicPageProps) {
  return (
    <Suspense fallback={null}>
      <PageContent params={params} />
    </Suspense>
  );
}

/** Resolves the URL-specific Page inside its request-aware boundary. */
async function PageContent({ params }: Pick<PublicPageProps, "params">) {
  const input = await resolvePageParams(params);
  const preview = await readPagePreviewContent(input);
  if (Option.isSome(preview)) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">{preview.value.body}</main>
    );
  }
  const page = await renderCurrentPublishedPage(input);
  if (!page) {
    notFound();
  }
  return <main className="mx-auto max-w-3xl px-6 py-20">{page.body}</main>;
}
