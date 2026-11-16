import { lazy } from "@repo/design-system/lib/lazy";
import { ClientOnly } from "@tanstack/react-router";
import { Suspense } from "react";
import { WeatherGap } from "@/components/ai/home/weather/card";

/**
 * Loads the weather widget and its request after the page renders. Until the
 * chunk arrives, an empty cell at the card's size holds the grid, as the server
 * render does.
 *
 * The Suspense boundary mounts only once the page has hydrated, inside
 * `ClientOnly`, so the widget's first suspension shows the boundary's own empty
 * cell in place of `ClientOnly`'s. A boundary that had already shown a cell would
 * hide it with `display: none` and set its fallback beside it, and the grid would
 * hold a third cell until the chunk arrived.
 */
const LazyDeferredWeather = lazy(() =>
  import("@/components/ai/home/weather/widget").then((module) => ({
    default: module.WeatherWidget,
  }))
);

export function DeferredWeather() {
  return (
    <ClientOnly fallback={<WeatherGap />}>
      <Suspense fallback={<WeatherGap />}>
        <LazyDeferredWeather />
      </Suspense>
    </ClientOnly>
  );
}
