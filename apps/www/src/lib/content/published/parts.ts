import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import "@tanstack/react-start/server-only";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect, Schema } from "effect";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import { queryPinnedContentStore } from "@/lib/content/store/query";
import { readImmutableContentStore } from "@/lib/content/store/read";
import { httpLayer } from "@/lib/convex/http";

/**
 * The signed release document and renderer manifest of one release, which every
 * public body of the release is verified against. The content store keeps them
 * for the release, so a build reads them from Convex once. The read is pinned to
 * the release that the body's own query answered under, so a release that lands
 * between the two reads fails as `PublishedReleaseMismatchError`.
 */
export const readReleaseFrame = Effect.fn("NakafaContent.readReleaseFrame")(
  function* (release: ActiveContentReleaseId) {
    return yield* queryPinnedContentStore(
      release,
      contentRelease.runtime.active.frame,
      {}
    );
  }
);

/**
 * The signed artifact of one routed public body, by the hash its head names. An
 * artifact never changes, so the content store keeps it by its hash alone: every
 * later release that keeps the body answers it without asking Convex, and only a
 * changed body is read again. Convex answers it only while the route's active
 * head names the hash, and answers nothing otherwise.
 */
export const readPublicArtifact = Effect.fn("NakafaContent.readPublicArtifact")(
  function* (args: Ref.Args<typeof contentRelease.runtime.active.artifact>) {
    const ref = contentRelease.runtime.active.artifact;
    return yield* readImmutableContentStore({
      kind: ref.convexFunctionName,
      load: Effect.flatMap(HttpClient.HttpClient, (client) =>
        client.query(ref, args)
      ).pipe(
        Effect.provide(httpLayer()),
        Effect.map((answer) => answer?.artifactJson ?? null)
      ),
      parts: [args.artifactHash],
      schema: Schema.String,
    });
  }
);
