import "@tanstack/react-start/server-only";
import { Effect } from "effect";
import type { Locale } from "use-intl";
import { decodeMaterialModel } from "@/lib/content/material/model";
import {
  fetchMaterialLesson,
  readMaterialSource,
} from "@/lib/content/material/source";
import { renderMaterialArtifact } from "@/lib/content/published/material";

/** Verifies the complete query result before evaluating its immutable body. */
const decodeMaterialDelivery = Effect.fn("NakafaMaterial.decodeDelivery")(
  function* (
    source: Effect.Success<ReturnType<typeof readMaterialSource>>,
    locale: Locale,
    publicPath: string
  ) {
    const decoded = yield* decodeMaterialModel(source, locale, publicPath);
    if (!decoded) {
      return null;
    }
    const published = yield* renderMaterialArtifact(decoded.narrowed);
    return {
      model: decoded.model,
      published,
    };
  }
);

/** Reads and verifies one signed material delivery for the lesson page. */
export const getMaterialPublication = Effect.fn(
  "NakafaMaterial.getPublication"
)(function* (locale: Locale, publicPath: string) {
  const source = yield* fetchMaterialLesson(locale, publicPath);
  const assembled = yield* readMaterialSource(source, locale, publicPath);
  return yield* decodeMaterialDelivery(assembled, locale, publicPath);
});
