"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { WeatherFrame } from "@/components/ai/home/weather/card";

/**
 * Loads the weather widget and its request after the page renders. Until the
 * chunk arrives, the widget's frame at its final size holds the grid cell, as the
 * server render does.
 */
export const DeferredWeather = lazyComponent(
  () =>
    import("@/components/ai/home/weather/widget").then(
      (module) => module.WeatherWidget
    ),
  {
    loading: () => <WeatherFrame />,
    ssr: false,
  }
);
