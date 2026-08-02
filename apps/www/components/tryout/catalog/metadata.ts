import "server-only";

import type { TryoutCatalogRow } from "@nakafa/aksara-contracts/tryout/spec";
import { readStaticPublicTryoutRoutes } from "@repo/contents/_types/route/tryout/static";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { getRuntimeTryoutMetadata } from "@/lib/content/runtime/routes";
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

/** Generates exact canonical metadata for one public try-out hierarchy route. */
export async function generateTryoutRouteMetadata(
  input: TryoutMetadataInput
): Promise<Metadata> {
  const [published, tTryouts] = await Promise.all([
    Effect.runPromise(getRuntimeTryoutMetadata(input)),
    getTranslations({ locale: input.locale, namespace: "Tryouts" }),
  ]);
  const source = published.managed
    ? published.route
    : readStaticMetadata(input);

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

/** Resolves route copy from the filesystem registry before signed ownership. */
function readStaticMetadata(
  input: TryoutMetadataInput
): TryoutMetadataSource | null {
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
