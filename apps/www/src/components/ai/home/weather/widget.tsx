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
import { type ComponentProps, Suspense, use, useState } from "react";
import { useTranslations } from "use-intl";
import {
  WeatherCard,
  WeatherCardHeader,
  WeatherFrame,
  WeatherGap,
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
    <Suspense fallback={<WeatherFrame />}>
      <WeatherSummary weather={weather} />
    </Suspense>
  );
}

/**
 * Shows the summary once its request settles. A failed request shows an empty
 * cell of the same size, so the grid keeps its shape.
 */
function WeatherSummary({ weather }: { weather: Promise<WeatherRead> }) {
  const t = useTranslations("Weather");
  const read = use(weather);

  if (Option.isNone(read)) {
    return <WeatherGap />;
  }

  const data = read.value;
  const city = data.city || t("unknown-location");
  const country = data.countryName ?? t("unknown-country");
  const currentTemp = kelvinToCelsius(data.temperatureKelvin);
  const condition = data.condition || "Clear";
  const conditionTitle = condition.charAt(0).toUpperCase() + condition.slice(1);
  const iconCode = data.icon || "01d";
  const place = `${city}, ${country}`;

  return (
    <WeatherCard>
      <div className="flex flex-col gap-1">
        <WeatherCardHeader>
          <p className="whitespace-nowrap font-mono text-xl tracking-tight">
            {currentTemp}° C
          </p>
          <HugeIcons
            className="size-6 shrink-0"
            icon={getWeatherIcon(iconCode)}
          />
        </WeatherCardHeader>
        <p className="line-clamp-2 text-card-foreground text-xs">
          {conditionTitle}
        </p>
      </div>

      <p className="line-clamp-2 text-pretty text-xs" title={place}>
        {place}
      </p>
    </WeatherCard>
  );
}
