"use client";

import { Activity, type ComponentType } from "react";

/**
 * Gives a lesson renderer whose code loads on demand its own hydration
 * boundary.
 *
 * `next/dynamic` renders through `React.lazy`, which suspends on its first
 * render even once its chunk has loaded. Without a boundary of its own, that
 * suspension holds the hydration of the whole lesson, and a press that lands
 * meanwhile cannot hydrate it synchronously: React client-renders the lesson
 * and the press is lost. A visible `Activity` lets React hydrate the lesson
 * around the renderer, which hydrates on its own once its code is ready.
 * Unlike a Suspense boundary it has no fallback, so a client navigation still
 * waits for the renderer before it shows the lesson.
 * https://react.dev/reference/react/Activity
 */
export function withHydrationBoundary<P extends object>(
  Renderer: ComponentType<P>
) {
  function HydrationBoundary(props: P) {
    return (
      <Activity mode="visible">
        <Renderer {...props} />
      </Activity>
    );
  }
  return HydrationBoundary;
}
