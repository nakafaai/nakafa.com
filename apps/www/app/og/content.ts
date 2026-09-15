import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { api } from "@repo/backend/convex/_generated/api";
import { resolveReferenceInput } from "@repo/backend/convex/contentRelease/reference/input";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { parseMaterialParams } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { toMaterialMetadataCopy } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/metadata";
import { resolveMaterialOwner } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/owner";
import { readArticleOgMetadata } from "@/app/og/article";
import { env } from "@/env";
import { getMaterialModel } from "@/lib/content/material/publication";
import { getCachedMetadataFromSlug } from "@/lib/utils/system";

/** Title and description copy resolved for one social image. */
export interface OgCopy {
  readonly description: string;
  readonly title: string;
}

/** Reads translated default copy for routes without signed ownership. */
async function readDefaultOgCopy(
  locale: Locale,
  slug: string[]
): Promise<OgCopy> {
  const fallback = await getCachedMetadataFromSlug(locale, slug);
  return {
    description: fallback.description ?? fallback.title,
    title: fallback.title,
  };
}

/** Reads OG copy through the same exclusive owner as each content page.
 *
 * Returns null when no release resolves instead of rendering not-found, so
 * image routes fall back to brand artwork without hosting the shell. */
export async function readOgMetadata(
  locale: Locale,
  slug: string[]
): Promise<OgCopy | null> {
  if (slug[0] === "articles") {
    return await readArticleOgMetadata(locale, slug);
  }

  const params = parseMaterialParams(locale, slug);
  if (!params) {
    const input = await Effect.runPromise(
      resolveReferenceInput({
        appLocale: locale,
        kind: "route",
        publicPath: slug.join("/"),
      })
    );
    if (!input) {
      return await readDefaultOgCopy(locale, slug);
    }
    const reference = await Effect.runPromise(
      readNakafaRuntimeQuery(
        env.NEXT_PUBLIC_CONVEX_URL,
        api.contentRelease.reference.read,
        {
          input: {
            appLocale: locale,
            kind: "route",
            publicPath: slug.join("/"),
          },
        }
      )
    );
    if (!reference) {
      return null;
    }
    return await readDefaultOgCopy(locale, slug);
  }

  const owner = await resolveMaterialOwner(Promise.resolve(params));
  if (!owner) {
    return null;
  }
  if (owner.kind === "preview") {
    return toMaterialMetadataCopy({ metadata: owner.preview.metadata });
  }
  const publication = await getMaterialModel(owner.locale, owner.publicPath);
  if (!publication?.model.projection) {
    return null;
  }
  return toMaterialMetadataCopy({
    metadata: publication.model.projection.metadata,
  });
}
