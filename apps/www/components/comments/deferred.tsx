"use client";

import { Intersection } from "@repo/design-system/components/ui/intersection";
import { lazyComponent } from "@repo/design-system/lib/lazy";
import { useState } from "react";
import { CommentsSlugContext } from "@/components/comments/slug.client";

const LazyComments = lazyComponent(
  () => import("@/components/comments").then((module) => module.Comments),
  {
    ssr: false,
    loading: () => null,
  }
);

/**
 * Defers the comments bundle and live Convex page until the footer is nearby.
 * The lightweight anchor keeps the table-of-contents comments link functional
 * before the interactive feed mounts.
 */
export function DeferredComments({ slug }: { slug: string }) {
  const [isNearViewport, setIsNearViewport] = useState(false);

  if (isNearViewport) {
    return (
      <CommentsSlugContext value={slug}>
        <LazyComments />
      </CommentsSlugContext>
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
