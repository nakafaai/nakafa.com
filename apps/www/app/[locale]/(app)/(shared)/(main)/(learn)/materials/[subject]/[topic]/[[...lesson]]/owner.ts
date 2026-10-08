import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Effect, Option, Schema } from "effect";
import { io } from "next/cache";
import type { Locale } from "next-intl";
import {
  type MaterialParams,
  readMaterialRequest,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import {
  type MaterialPreviewContent,
  readMaterialPreview,
} from "@/lib/content/preview/material";

const PublishedOwnerSchema = Schema.Struct({
  kind: Schema.Literal("published"),
  locale: AppLocaleCodeSchema,
  publicPath: Schema.String,
});
type PublishedOwner = typeof PublishedOwnerSchema.Type;

/** Keeps the discriminant a literal type, so the owner union narrows on it. */
const previewKind = "preview" as const;

/** Wraps an authenticated preview. Its body holds React content, so no Schema describes it. */
function toPreviewOwner(appLocale: Locale, preview: MaterialPreviewContent) {
  return { appLocale, kind: previewKind, preview };
}
type PreviewOwner = ReturnType<typeof toPreviewOwner>;

export type MaterialOwner = PreviewOwner | PublishedOwner;

/** Reads a local overlay only in the explicitly configured preview child. */
async function readPreviewOwner(
  params: Awaited<MaterialParams>,
  appLocale: Locale
): Promise<Option.Option<PreviewOwner>> {
  if (!hasPreviewConfig()) {
    return Option.none();
  }
  await io();
  return Option.map(
    await Effect.runPromise(readMaterialPreview({ params })),
    (preview) => toPreviewOwner(appLocale, preview)
  );
}

/** Selects an authenticated preview or the signed Aksara publication.
 *
 * Returns null when no public path resolves instead of rendering not-found,
 * so static consumers such as social images can fall back without hosting
 * the application shell. Page readers keep failing closed on null. */
export async function resolveMaterialOwner(
  params: MaterialParams
): Promise<MaterialOwner | null> {
  const routeParams = await params;
  const request = await readMaterialRequest(Promise.resolve(routeParams));
  const preview = await readPreviewOwner(routeParams, request.locale);
  if (Option.isSome(preview)) {
    return preview.value;
  }

  if (!request.publicPath) {
    return null;
  }
  return {
    kind: "published",
    locale: request.locale,
    publicPath: request.publicPath,
  };
}
