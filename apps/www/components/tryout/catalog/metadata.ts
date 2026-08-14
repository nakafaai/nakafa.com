import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { readTryoutMetadata } from "@/components/tryout/catalog/server";
import { resolveTryoutExamSocialImage } from "@/lib/tryout/social-images";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createResolvedRouteAlternates } from "@/lib/utils/seo/alternates";

type TryoutMetadataKind = Parameters<typeof readTryoutMetadata>[0]["kind"];

interface TryoutMetadataQueryInput {
  readonly locale: Locale;
  readonly publicPath: string;
}

type TryoutMetadataInput =
  | (TryoutMetadataQueryInput & {
      readonly countryKey: string;
      readonly examKey: string;
      readonly kind: "exam";
    })
  | (TryoutMetadataQueryInput & {
      readonly kind: Exclude<TryoutMetadataKind, "exam">;
    });

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
  const image =
    input.kind === "exam"
      ? Effect.runSync(
          resolveTryoutExamSocialImage({
            countryKey: input.countryKey,
            examKey: input.examKey,
            appLocale,
            publicPath: source.publicPath,
          })
        )
      : getOgUrl(input.locale, source.publicPath);

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
