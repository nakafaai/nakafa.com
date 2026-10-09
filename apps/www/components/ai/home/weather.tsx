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
import { getCountryName } from "@repo/design-system/lib/locale/country";
import { Match } from "effect";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { useWeather } from "@/lib/weather/query";

const KELVIN_TO_CELSIUS = 273.15;

function kelvinToCelsius(kelvin: number): number {
  return Math.round(kelvin - KELVIN_TO_CELSIUS);
}

function getWeatherIcon(
  iconCode: string
): ComponentProps<typeof HugeIcons>["icon"] {
  return Match.value(iconCode).pipe(
    Match.when("01d", () => Sun01Icon),
    Match.when("01n", () => Moon01Icon),
    Match.when("02d", () => SunCloudSlowWindIcon),
    Match.when("02n", () => MoonCloudSlowWindIcon),
    Match.whenOr("03d", "03n", () => CloudIcon),
    Match.whenOr("04d", "04n", () => CloudFastWindIcon),
    Match.whenOr("09d", "09n", () => CloudMidRainIcon),
    Match.when("10d", () => SunCloudLittleRainIcon),
    Match.when("10n", () => MoonCloudLittleRainIcon),
    Match.whenOr("11d", "11n", () => CloudAngledZapIcon),
    Match.whenOr("13d", "13n", () => SnowIcon),
    Match.whenOr("50d", "50n", () => CloudIcon),
    Match.orElse(() => CloudIcon)
  );
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
          <Skeleton className="size-8" />
        </WeatherCardHeader>

        <Skeleton className="h-3 w-24" />
      </WeatherCard>
    );
  }

  if (!data) {
    return null;
  }

  const city = data.city || t("unknown-location");
  const country = getCountryName(data.country) || t("unknown-country");
  const currentTemp = kelvinToCelsius(data.temperatureKelvin);
  const condition = data.condition || "Clear";
  const conditionTitle = condition.charAt(0).toUpperCase() + condition.slice(1);
  const iconCode = data.icon || "01d";

  return (
    <WeatherCard>
      <WeatherCardHeader>
        <div className="flex flex-col">
          <p className="font-mono text-xl tracking-tight">{currentTemp}° C</p>
          <p className="text-card-foreground text-xs">{conditionTitle}</p>
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
    <div className="flex aspect-square flex-col justify-between overflow-hidden rounded-md border bg-linear-to-br from-[color-mix(in_oklch,var(--secondary)_19%,var(--card))] to-[color-mix(in_oklch,var(--primary)_19%,var(--card))] p-3 text-card-foreground shadow-xs">
      {children}
    </div>
  );
}

function WeatherCardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">{children}</div>
  );
}
