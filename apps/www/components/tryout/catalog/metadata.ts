import "server-only";

import type { TryoutCatalogRow } from "@nakafa/aksara-contracts/tryout/spec";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { readTryoutMetadata } from "@/components/tryout/catalog/server";
import { resolveTryoutExamSocialImage } from "@/lib/tryout/social-images";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createResolvedRouteAlternates } from "@/lib/utils/seo/alternates";

type TryoutRouteKind = TryoutCatalogRow["kind"];

interface TryoutMetadataBaseInput {
  readonly locale: Locale;
  readonly publicPath: string;
}

type TryoutMetadataInput =
  | (TryoutMetadataBaseInput & {
      readonly countryKey: string;
      readonly examKey: string;
      readonly kind: "exam";
    })
  | (TryoutMetadataBaseInput & {
      readonly kind: Exclude<TryoutRouteKind, "exam">;
    });

interface TryoutMetadataQueryInput {
  readonly kind: TryoutCatalogRow["kind"];
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
  input: TryoutMetadataInput
): Promise<Metadata> {
  const queryInput: TryoutMetadataQueryInput = {
    kind: input.kind,
    locale: input.locale,
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
            locale: input.locale,
            publicPath: source.publicPath,
          })
        )
      : getOgUrl(input.locale, source.publicPath);

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
      image,
    }),
  };
}
