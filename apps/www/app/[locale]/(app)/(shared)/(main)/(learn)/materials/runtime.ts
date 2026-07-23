import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import { Effect, Option, Schema } from "effect";
import { connection } from "next/server";
import type { Locale } from "next-intl";
import { readMaterialRequestRoute } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/resolve";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import type {
  MaterialRouteParams,
  MaterialRouteTarget,
} from "@/lib/content/material";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import type { MaterialPreviewInput } from "@/lib/content/preview/material";
import { readMaterialPreview } from "@/lib/content/preview/material";
import { fetchRuntimeCurriculumPage } from "@/lib/content/runtime/pages";

/** The route exists, but its synchronized runtime projection is unavailable. */
class MaterialRuntimeMissingError extends Schema.TaggedError<MaterialRuntimeMissingError>()(
  "MaterialRuntimeMissingError",
  {
    locale: ContentLocaleSchema,
    sourcePath: Schema.String,
  }
) {}

/** Reads a local material overlay only inside the configured development child. */
export async function getMaterialPreviewData(input: MaterialPreviewInput) {
  if (!hasPreviewConfig()) {
    return Option.none();
  }

  await connection();

  return await Effect.runPromise(readMaterialPreview(input));
}

/** Caches one exact active route decision under publication invalidation. */
export async function getMaterialRouteData(input: {
  readonly params: MaterialRouteParams;
  readonly target: MaterialRouteTarget;
}) {
  "use cache";

  applyContentRuntimeCache();

  return await Effect.runPromise(
    readMaterialRequestRoute(input.params, input.target)
  );
}

/** Loads one cached Convex material row for metadata and page rendering. */
export async function getMaterialPageData({
  locale,
  sourcePath,
}: {
  locale: Locale;
  sourcePath: string;
}) {
  "use cache";

  applyContentRuntimeCache();

  const page = await fetchRuntimeCurriculumPage({
    locale,
    slug: sourcePath,
  });

  if (page) {
    return page;
  }

  return await Effect.runPromise(
    Effect.fail(new MaterialRuntimeMissingError({ locale, sourcePath }))
  );
}
