import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { readTryoutMetadata } from "@/components/tryout/catalog/server";
import { createResolvedRouteAlternates } from "@/lib/seo/alternates";
import { resolveTryoutExamArtwork } from "@/lib/tryout/artwork";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";

type TryoutMetadataKind = Parameters<typeof readTryoutMetadata>[0]["kind"];

interface TryoutMetadataQueryInput {
  readonly kind: TryoutMetadataKind;
  readonly locale: Locale;
  readonly publicPath: string;
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
  input: TryoutMetadataQueryInput
): Promise<Metadata> {
  const appLocale = AppLocaleSchema.make(input.locale);
  const queryInput = {
    appLocale,
    kind: input.kind,
    publicPath: input.publicPath,
  };
  const [published, tTryouts] = await Promise.all([
    readTryoutMetadata(queryInput),
    getTranslations({ locale: input.locale, namespace: "Tryouts" }),
  ]);
  const source = published.route;

  if (!source) {
    notFound();
  }

  const path = `/${input.locale}/${source.publicPath}`;
  const description = source.description ?? tTryouts("metadata-description");
  let image: string;
  if (input.kind === "exam") {
    if (!source.socialImageIdentity) {
      notFound();
    }
    image = Effect.runSync(
      resolveTryoutExamArtwork({
        ...source.socialImageIdentity,
        appLocale,
        publicPath: source.publicPath,
      })
    ).socialImageSrc;
  } else {
    image = getOgUrl(input.locale, source.publicPath);
  }

  return {
    title: { absolute: source.title },
    description,
    alternates: createResolvedRouteAlternates(
      { appLocale, publicPath: source.publicPath },
      source.alternates
    ),
    ...getSocialMetadata({
      title: source.title,
      description,
      locale: input.locale,
      path,
      image,
    }),
  };
}
