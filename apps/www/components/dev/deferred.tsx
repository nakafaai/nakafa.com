"use client";

import dynamic from "next/dynamic";

/**
 * Loads the local preview listener only where a preview layout renders it. A
 * Client Component that a layout imports is part of every route's first
 * JavaScript, and a production layout never renders this one.
 */
export const DeferredPreviewRefresh = dynamic(
  () =>
    import("@/components/dev/refresh").then((module) => module.PreviewRefresh),
  {
    loading: () => null,
    ssr: false,
  }
);
