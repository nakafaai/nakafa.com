"use client";

import { Intersection } from "@repo/design-system/components/ui/intersection";
import dynamic from "next/dynamic";
import { useState } from "react";

const LazyComments = dynamic(
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
    return <LazyComments slug={slug} />;
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
