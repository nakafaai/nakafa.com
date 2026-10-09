"use client";

import dynamic from "next/dynamic";
import { WeatherSkeleton } from "@/components/ai/home/weather/card";

/**
 * Loads the weather widget and its request after the page renders. Until the
 * chunk arrives, the same square skeleton holds the grid cell, as the server
 * render does.
 */
export const DeferredWeather = dynamic(
  () =>
    import("@/components/ai/home/weather/widget").then(
      (module) => module.WeatherWidget
    ),
  {
    loading: () => <WeatherSkeleton />,
    ssr: false,
  }
);
