"use client";

import { Intersection } from "@repo/design-system/components/ui/intersection";
import { lazyComponent } from "@repo/design-system/lib/lazy";
import { useState } from "react";
import { CommentsSlugContext } from "@/components/comments/slug";
import { ConvexIsland } from "@/components/providers/island";

const LazyComments = lazyComponent(
  () => import("@/components/comments").then((module) => module.Comments),
  {
    ssr: false,
    loading: () => null,
  }
);

/**
 * Defers the comments bundle and live Convex feed until the footer is nearby.
 * The lightweight anchor keeps the table-of-contents comments link functional
 * before the feed mounts. A visitor's page holds no Convex client, so the feed
 * never mounts for a visitor and the anchor stays.
 */
export function DeferredComments({ slug }: { slug: string }) {
  const [isNearViewport, setIsNearViewport] = useState(false);

  if (isNearViewport) {
    return (
      <ConvexIsland
        fallback={<div aria-hidden="true" className="h-px" id="comments" />}
      >
        <CommentsSlugContext value={slug}>
          <LazyComments />
        </CommentsSlugContext>
      </ConvexIsland>
    );
  }

  return (
    <Intersection
      aria-hidden="true"
      className="h-px"
      id="comments"
      once
      onIntersect={() => setIsNearViewport(true)}
    />
  );
}
