import "server-only";

import type { TryoutCatalogRow } from "@nakafa/aksara-contracts/tryout/spec";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { readTryoutMetadata } from "@/components/tryout/catalog/server";
import { isSamePublicRouteIdentity } from "@/lib/routing/locale/identity";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createResolvedRouteAlternates } from "@/lib/utils/seo/alternates";

interface TryoutMetadataInput {
  readonly kind: TryoutCatalogRow["kind"];
  readonly locale: Locale;
  readonly publicPath: string;
}

interface TryoutMetadataSource {
  readonly alternates: readonly {
    readonly locale: Locale;
    readonly publicPath: string;
  }[];
  readonly description?: string;
  readonly publicPath: string;
  readonly title: string;
}

interface RetainedTryoutMetadataSource {
  readonly description?: string;
  readonly title: string;
}

/** Creates private metadata for one authenticated retained attempt route. */
export function createRetainedTryoutMetadata(
  source: RetainedTryoutMetadataSource
): Metadata {
  return {
    description: source.description,
    robots: { follow: false, index: false },
    title: { absolute: source.title },
  };
}

/** Generates exact canonical metadata for one public try-out hierarchy route. */
export async function generateTryoutRouteMetadata(
  input: TryoutMetadataInput
): Promise<Metadata> {
  const [published, tTryouts] = await Promise.all([
    readTryoutMetadata(input),
    getTranslations({ locale: input.locale, namespace: "Tryouts" }),
  ]);
  const source = published.managed
    ? published.route
    : await readStaticMetadata(input);

  if (!source) {
    notFound();
  }

  const path = `/${input.locale}/${source.publicPath}`;
  const description = source.description ?? tTryouts("metadata-description");

  return {
    title: { absolute: source.title },
    description,
    alternates: createResolvedRouteAlternates(
      { locale: input.locale, publicPath: source.publicPath },
      source.alternates
    ),
    ...getSocialMetadata({
      title: source.title,
      description,
      locale: input.locale,
      path,
      image: getOgUrl(input.locale, source.publicPath),
    }),
  };
}

/**
 * Resolves route copy from the filesystem registry before signed ownership.
 *
 * This static-generation fallback stays on the framework Promise boundary so
 * managed routes never load the retired corpus and prerendering does not start
 * an Effect runtime that reads current time.
 *
 * @see https://nextjs.org/docs/messages/next-prerender-current-time
 */
async function readStaticMetadata(input: TryoutMetadataInput) {
  const { readStaticPublicTryoutRoutes } = await import(
    "@repo/contents/_types/route/tryout/static"
  );
  const routes = readStaticPublicTryoutRoutes();
  const route = routes.find(
    (candidate) =>
      candidate.kind === `tryout-${input.kind}` &&
      candidate.locale === input.locale &&
      candidate.publicPath === input.publicPath
  );

  if (!route) {
    return null;
  }

  const alternates: TryoutMetadataSource["alternates"][number][] = [];
  for (const candidate of routes) {
    if (!isSamePublicRouteIdentity(route, candidate)) {
      continue;
    }

    alternates.push({
      locale: candidate.locale,
      publicPath: candidate.publicPath,
    });
  }

  return {
    alternates,
    description: route.description,
    publicPath: route.publicPath,
    title: route.title,
  };
}
