import assert from "node:assert/strict";
import { readProtectedContent } from "@repo/backend/client/content/protected";
import { api } from "@repo/backend/convex/_generated/api";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { ConvexHttpClient } from "convex/browser";
import { Effect } from "effect";
import { makeTryoutRuntimeRequest } from "@/components/tryout/content/request";
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
  const target = {
    siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
    token: contentRuntimeKeys().CONTENT_RUNTIME_TOKEN,
  };
  const manifest = yield* rendererManifest;
  const response = yield* readProtectedContent(
    target,
    yield* makeTryoutRuntimeRequest([featured.question]),
    manifest
  );
  const item = response.items[0];
  assert(item, "The featured signed snapshot returned no question artifact.");

  const selectedRenderers = yield* selectRendererImplementations(
    item.artifact.payload
  );
  const selectedRendererNames = selectedRenderers
    .map(({ name }) => name)
    .sort();
  const signedRendererNames = item.artifact.payload.requiredComponents
    .map(({ name }) => name)
    .sort();

  assert.deepEqual(
    selectedRendererNames,
    signedRendererNames,
    "Selected renderers differ from the authenticated artifact requirements."
  );

  return {
    contentKey: item.artifact.payload.contentKey,
    rendererDomain: item.artifact.payload.rendererDomain,
    runtime: "permanent",
    selectedRendererNames,
  };
});

const main = verifyFeaturedRenderer().pipe(
  Effect.tap((result) =>
    Effect.sync(() => process.stdout.write(`${JSON.stringify(result)}\n`))
  )
);

Effect.runPromise(main);
