"use client";

import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { cn, getCountryName } from "@repo/design-system/lib/utils";
import {
  CloudFogIcon,
  CloudIcon,
  CloudLightningIcon,
  CloudMoonIcon,
  CloudRainIcon,
  CloudRainWindIcon,
  CloudSnowIcon,
  CloudSunIcon,
  CloudyIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useWeather } from "@/lib/react-query/weather";

// Constants
const KELVIN_TO_CELSIUS = 273.15;

// Convert Kelvin to Celsius
function kelvinToCelsius(kelvin: number): number {
  return Math.round(kelvin - KELVIN_TO_CELSIUS);
}

// Get weather icon based on condition
function getWeatherIcon(iconCode: string, className?: string) {
  switch (iconCode) {
    case "01d":
      return <SunIcon className={cn("shrink-0", className)} />;
    case "01n":
      return <MoonIcon className={cn("shrink-0", className)} />;
    case "02d":
      return <CloudSunIcon className={cn("shrink-0", className)} />;
    case "02n":
      return <CloudMoonIcon className={cn("shrink-0", className)} />;
    case "03d":
    case "03n":
    case "04d":
    case "04n":
      return <CloudyIcon className={cn("shrink-0", className)} />;
    case "09d":
    case "09n":
      return <CloudRainWindIcon className={cn("shrink-0", className)} />;
    case "10d":
    case "10n":
      return <CloudRainIcon className={cn("shrink-0", className)} />;
    case "11d":
    case "11n":
      return <CloudLightningIcon className={cn("shrink-0", className)} />;
    case "13d":
    case "13n":
      return <CloudSnowIcon className={cn("shrink-0", className)} />;
    case "50d":
    case "50n":
      return <CloudFogIcon className={cn("shrink-0", className)} />;
    default:
      return <CloudIcon className={cn("shrink-0", className)} />;
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

  return (
    <WeatherCard>
      <WeatherCardHeader>
        <div className="flex flex-col">
          <p className="font-mono text-lg tracking-tight">{currentTemp}° C</p>
          <p className="text-muted-foreground text-xs">{conditionTitle}</p>
        </div>

        {getWeatherIcon(currentWeather.weather[0]?.icon || "01d", "size-8")}
      </WeatherCardHeader>

      <p className="text-pretty text-xs">
        {city}, {country}
      </p>
    </WeatherCard>
  );
}

function WeatherCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex aspect-square flex-col justify-between rounded-md border bg-card bg-linear-to-br from-secondary/10 to-primary/10 p-3 text-card-foreground shadow-xs">
      {children}
    </div>
  );
}

function WeatherCardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">{children}</div>
  );
}
