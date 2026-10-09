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
import { Match, Option } from "effect";
import { useTranslations } from "next-intl";
import { type ComponentProps, Suspense, use, useState } from "react";
import {
  WeatherCard,
  WeatherCardHeader,
  WeatherSkeleton,
} from "@/components/ai/home/weather/card";
import { readWeatherSummary, type WeatherRead } from "@/lib/weather/request";

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

/** Reads the weather once per mount; the shared request is reused for a minute. */
export function WeatherWidget() {
  const [weather] = useState(() => readWeatherSummary());

  return (
    <Suspense fallback={<WeatherSkeleton />}>
      <WeatherSummary weather={weather} />
    </Suspense>
  );
}

/** Shows the summary once its request settles. A failed request shows nothing. */
function WeatherSummary({ weather }: { weather: Promise<WeatherRead> }) {
  const t = useTranslations("Weather");
  const read = use(weather);

  if (Option.isNone(read)) {
    return null;
  }

  const data = read.value;
  const city = data.city || t("unknown-location");
  const country = data.countryName || t("unknown-country");
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
