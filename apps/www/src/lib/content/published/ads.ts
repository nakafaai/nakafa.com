import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import { Array as Arr } from "effect";
import { createElement, type ReactNode } from "react";
import { AdSlot } from "@/components/ads/slot";
import type { AdUnit } from "@/lib/ads/account";
import { adSlotIndices } from "@/lib/ads/placement";

/**
 * Sets the ad frames of one unit between the blocks of a lesson's or an article's
 * body, where `adSlotIndices` places them. Each slot is keyed by its content and
 * its place, so a move to another page mounts fresh frames and never keeps the
 * last page's ad. Only the readers of a lesson and an article load this module,
 * so no other page's code reaches the ad frame or the messages it reads.
 */
export function withAdSlots(artifact: SignedContentArtifact, unit: AdUnit) {
  const before = adSlotIndices(artifact.payload.contentTree.children);
  return (blocks: readonly ReactNode[]) =>
    Arr.flatMap(blocks, (block, index) =>
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
