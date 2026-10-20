import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { WeatherFrame } from "@/components/ai/home/weather/card";

/**
 * Loads the weather widget and its request after the page renders. Until the
 * chunk arrives, the widget's frame at its final size holds the grid cell, as the
 * server render does.
 */
const LazyDeferredWeather = lazy(() =>
  import("@/components/ai/home/weather/widget").then((module) => ({
    default: module.WeatherWidget,
  }))
);

export function DeferredWeather() {
  return (
    <Suspense fallback={<WeatherFrame />}>
      <ClientOnly fallback={<WeatherFrame />}>
        <LazyDeferredWeather />
      </ClientOnly>
    </Suspense>
  );
}
