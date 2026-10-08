import { HttpClient } from "@confect/js";
import refs from "@repo/backend/confect/_generated/refs";
import { resolveReferenceInput } from "@repo/backend/confect/contentRelease/reference/input";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { parseMaterialParams } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { toMaterialMetadataCopy } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/metadata";
import { resolveMaterialOwner } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/owner";
import { readArticleOgMetadata } from "@/app/og/article";
import { getMaterialModel } from "@/lib/content/material/publication";
import { httpLayer } from "@/lib/convex/http";
import { getCachedMetadataFromSlug } from "@/lib/utils/system";

/** Title and description copy resolved for one social image. */
const OgCopySchema = Schema.Struct({
  description: Schema.String,
  title: Schema.String,
});

export type OgCopy = typeof OgCopySchema.Type;

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
      Effect.flatMap(HttpClient.HttpClient, (client) =>
        client.query(refs.public.contentRelease.reference.read, {
          input: {
            appLocale: locale,
            kind: "route",
            publicPath: slug.join("/"),
          },
        })
      ).pipe(Effect.provide(httpLayer()))
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
    return toMaterialMetadataCopy({
      metadata: owner.preview.metadata,
    });
  }
  const publication = await getMaterialModel(owner.locale, owner.publicPath);
  if (!publication?.model.projection) {
    return null;
  }
  return toMaterialMetadataCopy({
    metadata: publication.model.projection.metadata,
  });
}
