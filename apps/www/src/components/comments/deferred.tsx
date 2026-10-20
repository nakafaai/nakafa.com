"use client";

import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { CommentsSlugContext } from "@/components/comments/slug";

const LazyComments = lazy(async () => ({
  default: await (() =>
    import("@/components/comments").then((module) => module.Comments))(),
}));

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
        <Suspense fallback={null}>
          <ClientOnly fallback={null}>
            <LazyComments />
          </ClientOnly>
        </Suspense>
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
