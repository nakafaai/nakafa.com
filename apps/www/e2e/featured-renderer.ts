import assert from "node:assert/strict";
import { readProtectedContent } from "@repo/backend/client/content/protected";
import { api } from "@repo/backend/convex/_generated/api";
import { semanticMdxComponents } from "@repo/design-system/lib/markdown/semantic";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { ConvexHttpClient } from "convex/browser";
import { Effect } from "effect";
import { makeCurrentTryoutRuntimeRequest } from "@/components/tryout/content/request";
import { env } from "@/env";
import { resolveRendererComponents } from "@/lib/content/renderer/components";
import { rendererManifest } from "@/lib/content/renderer/manifest";

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

  const components = yield* resolveRendererComponents(item.artifact.payload);
  const semanticNames = new Set(Object.keys(semanticMdxComponents));
  const loadedCustomNames = Object.keys(components)
    .filter((name) => !semanticNames.has(name))
    .sort();
  const signedCustomNames = item.artifact.payload.requiredComponents
    .map(({ name }) => name)
    .sort();

  assert.deepEqual(
    loadedCustomNames,
    signedCustomNames,
    "Loaded custom renderers differ from the authenticated artifact requirements."
  );

  return {
    contentKey: item.artifact.payload.contentKey,
    loadedCustomNames,
    rendererDomain: item.artifact.payload.rendererDomain,
  };
});

const result = await Effect.runPromise(verifyFeaturedRenderer());
process.stdout.write(`${JSON.stringify(result)}\n`);
