// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { ContentTreeElement } from "@nakafa/aksara-contracts/tree";
import { testSignedArtifact } from "@repo/backend/test/content/proof";
import { Array as Arr, Effect, Result } from "effect";
import { isValidElement } from "react";
import { AdSlot } from "@/components/ads/slot";
import { withAdSlots } from "@/lib/content/published/ads";

/** One block of a body's root, by its element name and text. */
function block(name: string, text: string): ContentTreeElement {
  return { $node: "element", children: [text], name, props: {} };
}

/** A lesson of an introduction and four sections, each a heading and a paragraph. */
const SECTIONED_TREE: ContentTreeElement = {
  $node: "element",
  children: [
    block("p", "Introduction"),
    ...Arr.flatMap(["One", "Two", "Three", "Four"], (title) => [
      block("h2", title),
      block("p", `${title} body`),
    ]),
  ],
  name: "fragment",
  props: {},
};

describe("ad slots of a body", () => {
  it.effect(
    "sets a lesson's ad frames after its second section and before its last",
    () =>
      Effect.gen(function* () {
        const artifact = yield* testSignedArtifact("site", {
          contentKey: "test:sections",
          contentTree: SECTIONED_TREE,
          rawMdx: "Introduction",
        });

        const blocks = withAdSlots(
          artifact,
          "material"
        )(Arr.map(SECTIONED_TREE.children, (_, index) => `block ${index}`));

        const slots = Arr.filterMap(blocks, (child, index) =>
          isValidElement<{ readonly unit: string }>(child) &&
          child.type === AdSlot
            ? Result.succeed({ index, key: child.key, unit: child.props.unit })
            : Result.failVoid
        );
        // Blocks: p, h2, p, h2, p, [slot], h2, p, [slot], h2, p.
        expect(slots).toEqual([
          { index: 5, key: "test:sections:5", unit: "material" },
          { index: 8, key: "test:sections:7", unit: "material" },
        ]);
        expect(blocks).toHaveLength(SECTIONED_TREE.children.length + 2);
      })
  );
});
