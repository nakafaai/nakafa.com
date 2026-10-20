"use client";

import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { CommentsSlugContext } from "@/components/comments/slug";
import { SignedInIsland } from "@/components/providers/island";

const LazyComments = lazy(() =>
  import("@/components/comments").then((module) => ({
    default: module.Comments,
  }))
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
      <SignedInIsland
        fallback={<div aria-hidden="true" className="h-px" id="comments" />}
      >
        <CommentsSlugContext value={slug}>
          <Suspense fallback={null}>
            <ClientOnly fallback={null}>
              <LazyComments />
            </ClientOnly>
          </Suspense>
        </CommentsSlugContext>
      </SignedInIsland>
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
