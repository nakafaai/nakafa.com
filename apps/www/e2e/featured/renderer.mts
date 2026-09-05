import assert from "node:assert/strict";
import {
  readProtectedContent,
  readSnapshotProtectedContent,
} from "@repo/backend/client/content/protected";
import { readFeaturedTryout } from "@repo/backend/content/tryout/featured";
import { api } from "@repo/backend/convex/_generated/api";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { Effect } from "effect";
import { makeTryoutRuntimeRequest } from "@/components/tryout/content/request";
import { env } from "@/env";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import { selectRendererImplementations } from "@/lib/content/renderer/selection";
import { fetchRuntimeQuery } from "@/lib/content/runtime/query";
import { loadContentSnapshot } from "@/lib/content/runtime/snapshot";

const verifyFeaturedRenderer = Effect.fn(
  "NakafaContent.verifyFeaturedRenderer"
)(function* () {
  const featured = yield* Effect.tryPromise(() =>
    fetchRuntimeQuery(
      api.tryouts.queries.catalog.getFeaturedQuestion,
      {
        appLocale: "en",
      },
      ({ appLocale }) => readFeaturedTryout(appLocale)
    )
  );
  const target = {
    siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
    token: contentRuntimeKeys().CONTENT_RUNTIME_TOKEN,
  };
  const manifest = yield* rendererManifest;
  const request = yield* makeTryoutRuntimeRequest([featured.question]);
  const snapshot = yield* Effect.tryPromise(() => loadContentSnapshot());
  const response =
    snapshot === undefined
      ? yield* readProtectedContent(target, request, manifest)
      : yield* readSnapshotProtectedContent(request, manifest).pipe(
          Effect.provideContext(snapshot)
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
