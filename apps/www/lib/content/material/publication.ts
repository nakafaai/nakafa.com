import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  applyPublishedCatalogCache,
  applyPublishedContentCache,
} from "@/lib/content/cache";
import {
  makeMaterialProjectionError,
  verifyMaterialPublication,
} from "@/lib/content/material/decode";
import { getPublishedMaterialRoute } from "@/lib/content/material/route";
import { readRenderedMaterial } from "@/lib/content/published/material";

class MaterialRouteReadError extends Schema.TaggedError<MaterialRouteReadError>()(
  "MaterialRouteReadError",
  {
    appLocale: AppLocaleSchema,
    cause: Schema.Unknown,
    publicPath: Schema.String,
  }
) {}

/** Caches one coherent material publication at the Next.js boundary. */
export async function getMaterialPublication(
  locale: Locale,
  publicPath: string
) {
  "use cache";

  const appLocale = AppLocaleSchema.make(locale);
  const readModel = Effect.tryPromise({
    catch: (cause) =>
      new MaterialRouteReadError({ appLocale, cause, publicPath }),
    try: () => getPublishedMaterialRoute(locale, publicPath),
  });
  const readPublished = readRenderedMaterial({ appLocale, publicPath }).pipe(
    Effect.catchTag("ContentRuntimeMissingError", () => Effect.succeed(null))
  );
  const program = Effect.gen(function* () {
    const [model, published] = yield* Effect.all([readModel, readPublished], {
      concurrency: "unbounded",
    });
    yield* Effect.sync(() => applyPublishedCatalogCache("material"));
    if (!model.projection) {
      if (published) {
        return yield* makeMaterialProjectionError({ appLocale, publicPath });
      }
      return null;
    }
    if (!published) {
      return yield* makeMaterialProjectionError({ appLocale, publicPath });
    }
    yield* verifyMaterialPublication(
      {
        activeReleaseId: model.activeReleaseId,
        projection: model.projection,
      },
      published
    );
    yield* Effect.sync(() =>
      applyPublishedContentCache("material", published.artifactHash)
    );
    return { model, published };
  });

  return await Effect.runPromise(program);
}
