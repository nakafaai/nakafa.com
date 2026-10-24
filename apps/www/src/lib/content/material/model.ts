import "@tanstack/react-start/server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect, Option } from "effect";
import type { Locale } from "use-intl";
import {
  makeMaterialProjectionError,
  verifyMaterialPublication,
} from "@/lib/content/material/decode";
import { decodePublishedMaterialRoute } from "@/lib/content/material/route";
import {
  fetchMaterialLesson,
  readMaterialSource,
} from "@/lib/content/material/source";
import { decodePublishedDelivery } from "@/lib/content/published/exchange";
import { decodeMaterialData } from "@/lib/content/published/material";

/** Verifies the signed query result without evaluating its immutable body.
 *
 * Static consumers such as social images resolve metadata through this seam
 * so their module graph never renders interactive renderers. */
export const decodeMaterialModel = Effect.fn("NakafaMaterial.decodeModel")(
  function* (
    source: Effect.Success<ReturnType<typeof readMaterialSource>>,
    locale: Locale,
    publicPath: string
  ) {
    const input = {
      appLocale: AppLocaleSchema.make(locale),
      publicPath,
    };
    const model = yield* decodePublishedMaterialRoute(
      source.model,
      locale,
      publicPath
    );
    if (!model.projection) {
      if (source.runtimeJson !== null) {
        return yield* makeMaterialProjectionError(input);
      }
      return Option.none();
    }
    if (source.runtimeJson === null) {
      return yield* makeMaterialProjectionError(input);
    }
    const data = yield* decodePublishedDelivery(input, source.runtimeJson);
    const narrowed = yield* decodeMaterialData(data, input);
    yield* verifyMaterialPublication(
      {
        activeReleaseId: model.activeReleaseId,
        projection: model.projection,
      },
      narrowed
    );
    return Option.some({
      model,
      narrowed,
    });
  }
);

/** Reads and verifies signed release metadata without rendering its body.
 *
 * Social images resolve copy through this seam so a missing release falls
 * back to brand artwork instead of rendering the application shell. */
export const getMaterialModel = Effect.fn("NakafaMaterial.getModel")(function* (
  locale: Locale,
  publicPath: string
) {
  const source = yield* fetchMaterialLesson(locale, publicPath);
  const assembled = yield* readMaterialSource(source, locale, publicPath);
  return yield* decodeMaterialModel(assembled, locale, publicPath);
});
