import assert from "node:assert/strict";
import { readProtectedContent } from "@repo/backend/client/content/protected";
import { api } from "@repo/backend/convex/_generated/api";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { ConvexHttpClient } from "convex/browser";
import { Effect } from "effect";
import { makeCurrentTryoutRuntimeRequest } from "@/components/tryout/content/request";
import { env } from "@/env";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import { selectRendererImplementations } from "@/lib/content/renderer/selection";

const verifyFeaturedRenderer = Effect.fn(
  "NakafaContent.verifyFeaturedRenderer"
)(function* () {
  const client = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
  const featured = yield* Effect.tryPromise(() =>
    client.query(api.tryouts.queries.catalog.getFeaturedQuestion, {
      appLocale: "en",
    })
  );
  const request = yield* makeCurrentTryoutRuntimeRequest([featured.question]);
  const manifest = yield* rendererManifest;
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

  const selectedRenderers = yield* selectRendererImplementations(
    item.artifact.payload
  );
  const selectedCustomNames = selectedRenderers
    .filter(({ kind }) => kind === "implementation")
    .map(({ name }) => name)
    .sort();
  const signedCustomNames = item.artifact.payload.requiredComponents
    .map(({ name }) => name)
    .sort();

  assert.deepEqual(
    selectedCustomNames,
    signedCustomNames,
    "Selected custom renderers differ from the authenticated artifact requirements."
  );

  return {
    contentKey: item.artifact.payload.contentKey,
    selectedCustomNames,
    rendererDomain: item.artifact.payload.rendererDomain,
  };
});

const main = verifyFeaturedRenderer().pipe(
  Effect.tap((result) =>
    Effect.sync(() => process.stdout.write(`${JSON.stringify(result)}\n`))
  )
);

Effect.runPromise(main);
