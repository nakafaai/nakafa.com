import { readProtectedContent } from "@repo/backend/client/content/protected";
import { api } from "@repo/backend/convex/_generated/api";
import { contentRuntimeKeys } from "@repo/site/keys";
import { readEnvironment } from "@repo/utilities/env";
import { JsonTextSchema } from "@repo/utilities/json";
import { ConvexHttpClient } from "convex/browser";
import { Array as Arr, Effect, Option, Order, Schema } from "effect";
import { makeTryoutRuntimeRequest } from "@/components/tryout/content/request";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import { readRuntimeConfig } from "@/runtime";

readRuntimeConfig();

/** The script runs in Node, where only process.env exists, so it reads its two Convex URLs here. */
const env = readEnvironment(
  {
    VITE_CONVEX_SITE_URL: Schema.String,
    VITE_CONVEX_URL: Schema.String,
  },
  {
    VITE_CONVEX_SITE_URL: process.env.VITE_CONVEX_SITE_URL,
    VITE_CONVEX_URL: process.env.VITE_CONVEX_URL,
  }
);

class FeaturedArtifactError extends Schema.TaggedError<FeaturedArtifactError>()(
  "FeaturedArtifactError",
  { message: Schema.String }
) {}

const verifyFeaturedRenderer = Effect.fn(
  "NakafaContent.verifyFeaturedRenderer"
)(function* () {
  const featured = yield* Effect.tryPromise(() =>
    new ConvexHttpClient(env.VITE_CONVEX_URL).query(
      api.tryouts.queries.catalog.getFeaturedQuestion,
      {
        appLocale: "en",
      }
    )
  );
  const manifest = yield* rendererManifest;
  const request = yield* makeTryoutRuntimeRequest([featured.question]);
  const response = yield* readProtectedContent(
    {
      siteUrl: env.VITE_CONVEX_SITE_URL,
      token: contentRuntimeKeys().CONTENT_READ_TOKEN,
    },
    request,
    manifest
  );
  const featuredItem = Arr.head(response.items);
  if (Option.isNone(featuredItem)) {
    return yield* new FeaturedArtifactError({
      message: "The featured signed snapshot returned no question artifact.",
    });
  }
  const item = featuredItem.value;

  // The protected exchange verifies compatibility with both signed and live manifests.
  const requiredRendererNames = Arr.sort(
    item.artifact.payload.requiredComponents,
    Order.String
  );

  return {
    contentKey: item.artifact.payload.contentKey,
    rendererDomain: item.artifact.payload.rendererDomain,
    runtime: "permanent",
    requiredRendererNames,
  };
});

const main = verifyFeaturedRenderer().pipe(
  Effect.flatMap((result) => Schema.encodeEffect(JsonTextSchema)(result)),
  Effect.tap((json) => Effect.sync(() => process.stdout.write(`${json}\n`)))
);

Effect.runPromise(main);
