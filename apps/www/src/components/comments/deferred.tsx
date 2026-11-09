"use client";

import { Intersection } from "@repo/design-system/components/ui/intersection";
import { lazy } from "@repo/design-system/lib/lazy";
import { ClientOnly } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { CommentsSlugContext } from "@/components/comments/slug";
import { SignedInIsland } from "@/components/providers/island";
import { useLiveSession } from "@/components/providers/live";

const LazyComments = lazy(() =>
  import("@/components/comments").then((module) => ({
    default: module.Comments,
  }))
);

/** The visitor's read-only client around the comments, which loads with them. */
const VisitorIsland = lazy(() =>
  import("@/components/comments/visitor").then((module) => ({
    default: module.VisitorIsland,
  }))
);

/** The anchor the outline's comments link jumps to, which stands until the comments take its place. */
function CommentsAnchor() {
  return <div aria-hidden="true" className="h-px" id="comments" />;
}

/**
 * Defers the comments bundle and their live feed until the footer is nearby. The lightweight anchor keeps
 * the outline's comments link working before the feed mounts. A learner reads and writes through the page's
 * client. A visitor, whose page holds no client, reads through a read-only client that loads with the
 * comments, and every write asks the visitor to sign in. While a learner's session still loads, the anchor
 * stays, so a learner never sees the visitor's comments first.
 */
export function DeferredComments({ slug }: { slug: string }) {
  const [isNearViewport, setIsNearViewport] = useState(false);

  if (!isNearViewport) {
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

  return (
    <CommentsSlugContext value={slug}>
      <Suspense fallback={<CommentsAnchor />}>
        <ClientOnly fallback={<CommentsAnchor />}>
          <SignedInIsland fallback={<VisitorComments />}>
            <LazyComments />
          </SignedInIsland>
        </ClientOnly>
      </Suspense>
    </CommentsSlugContext>
  );
}

/** A visitor's comments, once the page knows the reader has no session. */
function VisitorComments() {
  const isPending = useLiveSession(
    (state) => state.isPending || state.sessionId !== null
  );
  if (isPending) {
    return <CommentsAnchor />;
  }
  return (
    <VisitorIsland>
      <LazyComments />
    </VisitorIsland>
  );
}
