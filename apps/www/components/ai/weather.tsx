"use client";

import {
  CloudAngledZapIcon,
  CloudFastWindIcon,
  CloudIcon,
  CloudMidRainIcon,
  Moon01Icon,
  MoonCloudLittleRainIcon,
  MoonCloudSlowWindIcon,
  SnowIcon,
  Sun01Icon,
  SunCloudLittleRainIcon,
  SunCloudSlowWindIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { getCountryName } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { useWeather } from "@/lib/react-query/use-weather";

const KELVIN_TO_CELSIUS = 273.15;

function kelvinToCelsius(kelvin: number): number {
  return Math.round(kelvin - KELVIN_TO_CELSIUS);
}

function getWeatherIcon(
  iconCode: string
): ComponentProps<typeof HugeIcons>["icon"] {
  switch (iconCode) {
    case "01d":
      return Sun01Icon;
    case "01n":
      return Moon01Icon;
    case "02d":
      return SunCloudSlowWindIcon;
    case "02n":
      return MoonCloudSlowWindIcon;
    case "03d":
    case "03n":
      return CloudIcon;
    case "04d":
    case "04n":
      return CloudFastWindIcon;
    case "09d":
    case "09n":
      return CloudMidRainIcon;
    case "10d":
      return SunCloudLittleRainIcon;
    case "10n":
      return MoonCloudLittleRainIcon;
    case "11d":
    case "11n":
      return CloudAngledZapIcon;
    case "13d":
    case "13n":
      return SnowIcon;
    case "50d":
    case "50n":
      return CloudIcon;
    default:
      return CloudIcon;
  }
}

export function Weather() {
  const t = useTranslations("Weather");
  const { data, isLoading } = useWeather();

  if (isLoading) {
    return (
      <WeatherCard>
        <WeatherCardHeader>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-8" />
        </WeatherCardHeader>

        <Skeleton className="h-3 w-24" />
      </WeatherCard>
    );
  }

  if (!data?.list || data.list.length === 0) {
    return null;
  }

  const currentWeather = data.list[0];
  const city = data.geocoding?.city || t("unknown-location");
  const country =
    getCountryName(data.geocoding?.country) || t("unknown-country");
  const currentTemp = kelvinToCelsius(currentWeather.main.temp);
  const condition = currentWeather.weather[0]?.description || "Clear";
  const conditionTitle = condition.charAt(0).toUpperCase() + condition.slice(1);
  const iconCode = currentWeather.weather[0]?.icon || "01d";

  return (
    <WeatherCard>
      <WeatherCardHeader>
        <div className="flex flex-col">
          <p className="font-mono text-xl tracking-tight">{currentTemp}° C</p>
          <p className="text-card-foreground/80 text-xs">{conditionTitle}</p>
        </div>

        <HugeIcons className="size-8" icon={getWeatherIcon(iconCode)} />
      </WeatherCardHeader>

      <p className="text-pretty text-xs">
        {city}, {country}
      </p>
    </WeatherCard>
  );
}

function WeatherCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex aspect-square flex-col justify-between overflow-hidden rounded-md border bg-linear-to-br from-[color-mix(in_oklch,var(--secondary)_50%,var(--card))] to-[color-mix(in_oklch,var(--primary)_50%,var(--card))] p-3 text-card-foreground shadow-xs">
      {children}
    </div>
  );
}

function WeatherCardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">{children}</div>
  );
}
