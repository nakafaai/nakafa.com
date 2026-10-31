import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { WeatherGap } from "@/components/ai/home/weather/card";

/**
 * Loads the weather widget and its request after the page renders. Until the
 * chunk arrives, an empty cell at the card's size holds the grid, as the server
 * render does.
 */
const LazyDeferredWeather = lazy(() =>
  import("@/components/ai/home/weather/widget").then((module) => ({
    default: module.WeatherWidget,
  }))
);

export function DeferredWeather() {
  return (
    <Suspense fallback={<WeatherGap />}>
      <ClientOnly fallback={<WeatherGap />}>
        <LazyDeferredWeather />
      </ClientOnly>
    </Suspense>
  );
}
