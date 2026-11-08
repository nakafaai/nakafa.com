import "@tanstack/react-start/server-only";

import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import { renderServerComponent } from "@tanstack/react-start/rsc";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { createElement, type ReactNode } from "react";
import { AdSlot } from "@/components/ads/slot";
import { ContentBlocks } from "@/components/shared/content/blocks";
import type { AdUnit } from "@/lib/ads/account";
import { adSlotIndices } from "@/lib/ads/placement";
import { captureServerExceptionSafely } from "@/lib/analytics/exception.server";
import { renderVerifiedArtifact } from "@/lib/content/published/artifact";
import { ContentExecutionError } from "@/lib/content/published/errors";

/** The render failure of one body, which names the content and the stage and nothing else. */
const renderFailure = (artifact: SignedContentArtifact) =>
  new ContentExecutionError({
    contentKey: artifact.payload.contentKey,
    stage: "render",
  });

/**
 * Reports the cause of one failed body, then fails with its render error. The
 * error names only the content and the stage, so the cause reaches the report.
 */
const failBody = Effect.fn("NakafaContent.failBody")(function* (
  artifact: SignedContentArtifact,
  cause: unknown
) {
  yield* captureServerExceptionSafely(cause, { source: "content.body" });
  return yield* renderFailure(artifact);
});

/** A render that rejected, kept with its cause until the reader reports it. */
class BodyRenderError extends Schema.TaggedError<
  BodyRenderError,
  { readonly brand: unique symbol }
>()("BodyRenderError", { cause: Schema.Unknown }) {}

/**
 * Sets the ad frames of one unit between the blocks of a body, where
 * `adSlotIndices` places them. Each slot is keyed by its content and its place,
 * so a move to another page mounts fresh frames and never keeps the last page's ad.
 */
function withAdSlots(
  blocks: readonly ReactNode[],
  artifact: SignedContentArtifact,
  unit: AdUnit
) {
  const before = adSlotIndices(artifact.payload.contentTree.children);
  return Arr.flatMap(blocks, (block, index) =>
    Arr.contains(before, index)
      ? [
          createElement(AdSlot, {
            key: `${artifact.payload.contentKey}:${index}`,
            unit,
          }),
          block,
        ]
      : [block]
  );
}

/**
 * Reads the body of one signed artifact as a server component tree. Its text,
 * math and frames are server markup, and each interactive visual is a client
 * reference that its own boundary loads, so the body ships no JavaScript it does
 * not run. A lesson or an article names its ad unit, and its body holds the
 * places of its ad frames between sections; any other page names none.
 * `ContentBlocks` decides how many blocks a move draws at once. A missing
 * implementation fails as the renderer's own error, and a render that rejects is
 * reported with its cause and becomes one execution error.
 */
export const readRenderedBody = Effect.fn("NakafaContent.readRenderedBody")(
  function* (artifact: SignedContentArtifact, ads: Option.Option<AdUnit>) {
    const rendered = yield* renderVerifiedArtifact({ artifact });
    const blocks = Option.match(ads, {
      onNone: () => rendered.blocks,
      onSome: (unit) => withAdSlots(rendered.blocks, artifact, unit),
    });
    return yield* Effect.tryPromise({
      try: () =>
        renderServerComponent(createElement(ContentBlocks, null, ...blocks)),
      catch: (cause) => new BodyRenderError({ cause }),
    }).pipe(Effect.catch((error) => failBody(artifact, error.cause)));
  }
);
