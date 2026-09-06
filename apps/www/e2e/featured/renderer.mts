import assert from "node:assert/strict";
import { readProtectedContent } from "@repo/backend/client/content/protected";
import { api } from "@repo/backend/convex/_generated/api";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { fetchQuery } from "convex/nextjs";
import { Effect } from "effect";
import { makeTryoutRuntimeRequest } from "@/components/tryout/content/request";
import { env } from "@/env";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import { readRuntimeConfig } from "@/runtime";

readRuntimeConfig();

const verifyFeaturedRenderer = Effect.fn(
  "NakafaContent.verifyFeaturedRenderer"
)(function* () {
  const featured = yield* Effect.tryPromise(() =>
    fetchQuery(
      api.tryouts.queries.catalog.getFeaturedQuestion,
      {
        appLocale: "en",
      },
      { url: env.NEXT_PUBLIC_CONVEX_URL }
    )
  );
  const manifest = yield* rendererManifest;
  const request = yield* makeTryoutRuntimeRequest([featured.question]);
  const response = yield* readProtectedContent(
    {
      siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
      token: contentRuntimeKeys().CONTENT_RUNTIME_TOKEN,
    },
    request,
    manifest
  );
  const item = response.items[0];
  assert(item, "The featured signed snapshot returned no question artifact.");

  // The protected exchange verifies compatibility with both signed and live manifests.
  const requiredRendererNames = item.artifact.payload.requiredComponents
    .map(({ name }) => name)
    .sort();

  return {
    contentKey: item.artifact.payload.contentKey,
    rendererDomain: item.artifact.payload.rendererDomain,
    runtime: "permanent",
    requiredRendererNames,
  };
});

const main = verifyFeaturedRenderer().pipe(
  Effect.tap((result) =>
    Effect.sync(() => process.stdout.write(`${JSON.stringify(result)}\n`))
  )
);

Effect.runPromise(main);
