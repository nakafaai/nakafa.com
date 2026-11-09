import "@tanstack/react-start/server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { previewDocumentRoute } from "@nakafa/aksara-contracts/preview/document";
import { Effect, Option, Schema } from "effect";
import { readPreviewSnapshot } from "@/lib/content/preview/manifest";

/** Exact public route identity checked before Convex route rejection. */
const PreviewRouteInputSchema = Schema.Struct({
  appLocale: AppLocaleSchema,
  publicPath: Schema.String,
});
type PreviewRouteInput = typeof PreviewRouteInputSchema.Type;
/** Reports whether the selected changed document owns one exact public route. */
export const matchesPreviewRoute = Effect.fn(
  "NakafaContent.matchesPreviewRoute"
)(function* (input: PreviewRouteInput) {
  const snapshot = yield* readPreviewSnapshot();
  return Option.match(snapshot, {
    onNone: () => false,
    onSome: ({ manifest }) => {
      const route = previewDocumentRoute(manifest.document);
      return (
        route.appLocale === input.appLocale &&
        route.publicPath === input.publicPath
      );
    },
  });
});
