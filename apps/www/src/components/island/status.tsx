"use client";

import {
  ArrowLeft01Icon,
  CloudAngledRainIcon,
  CloudAngledZapIcon,
  CloudIcon,
  MapsIcon,
  Moon02Icon,
  SnowIcon,
  StarIcon,
  Sun03Icon,
  VolumeHighIcon,
  VolumeOffIcon,
} from "@hugeicons/core-free-icons";
import { balanceOf } from "@repo/backend/confect/island/things";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Meter } from "@repo/design-system/components/ui/meter";
import { useFormatter, useTranslations } from "use-intl";
import { panelVariants } from "@/components/island/panel";
import { useGame } from "@/components/island/store";
import { writeMuted } from "@/lib/island/settings";

/** The icon of each weather that covers the sky; a clear sky shows the sun or the moon alone. */
const WEATHER_ICONS = {
  clouds: CloudIcon,
  rain: CloudAngledRainIcon,
  snow: SnowIcon,
  storm: CloudAngledZapIcon,
} as const;

/** Two digits of the clock. */
function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * The learner's rank in their own world (ADR 0050, W5 and W7): their level,
 * the Stars left to open blueprints with, and a thin bar of how far their
 * lifetime Stars have come toward the next level.
 */
function Rank() {
  const t = useTranslations("Island");
  const format = useFormatter();
  const level = useGame((state) => state.level);
  const { from, lifetime, next } = useGame((state) => state.progress);
  const balance = useGame((state) =>
    balanceOf(state.progress.lifetime, state.blueprints)
  );
  const share = next > from ? (lifetime - from) / (next - from) : 1;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="flex items-center gap-3 text-sm font-medium whitespace-nowrap">
        <span>{t("level", { level })}</span>
        <span className="flex items-center gap-1 tabular-nums">
          <HugeIcons icon={StarIcon} />
          <span aria-hidden="true">{format.number(balance)}</span>
          <span className="sr-only">
            {t("stars", { stars: format.number(balance) })}
          </span>
        </span>
      </p>
      <Meter
        label={t("next", { level: level + 1, stars: next - lifetime })}
        percent={Math.round(Math.min(1, Math.max(0, share)) * 100)}
      />
    </div>
  );
}

/** Whose world the learner walks in when it is not their own (ADR 0050, W6): the owner's first name and level. */
function Host() {
  const t = useTranslations("Island");
  const name = useGame((state) => state.host?.name ?? "");
  const level = useGame((state) => state.host?.level ?? 1);
  return (
    <p className="flex min-w-0 flex-col">
      <span className="truncate text-sm font-medium">
        {t("world-of", { name })}
      </span>
      <span className="text-muted-foreground text-xs">
        {t("level", { level })}
      </span>
    </p>
  );
}

/** The top left of the HUD: the way out, then the learner's rank, or whose world this is. */
function Identity() {
  const t = useTranslations("Island");
  const leave = useGame((state) => state.leave);
  const visiting = useGame((state) => state.host !== null);
  return (
    <div
      className={panelVariants({
        className: "flex min-w-0 items-center gap-1 p-1 pr-3",
      })}
    >
      <h1 className="sr-only">{t("title")}</h1>
      <Button
        className="size-11"
        onClick={leave}
        size="icon"
        tooltip={t("leave")}
        variant="ghost"
      >
        <HugeIcons icon={ArrowLeft01Icon} />
      </Button>
      {visiting ? <Host /> : <Rank />}
    </div>
  );
}

/**
 * The learner's time of day, which the world's sky follows, with the sun by
 * day and the moon by night, and the weather over the world when it is not
 * clear.
 */
function Clock() {
  const t = useTranslations("Island");
  const minute = useGame((state) => state.minute);
  const weather = useGame((state) => state.weather);
  const hours = Math.floor(minute / 60);
  const time = `${twoDigits(hours)}:${twoDigits(minute % 60)}`;
  const day = hours >= 6 && hours < 18;
  return (
    <p className="flex h-6 items-center justify-center gap-1.5 px-1 text-sm tabular-nums max-sm:order-last max-sm:col-span-2 sm:h-11">
      <HugeIcons icon={day ? Sun03Icon : Moon02Icon} />
      <span className="sr-only">{t(day ? "day" : "night")}</span>
      <time dateTime={time}>{time}</time>
      {weather === "clear" ? null : <HugeIcons icon={WEATHER_ICONS[weather]} />}
      <span className="sr-only">{t(`weather-${weather}`)}</span>
    </p>
  );
}

/** The top right of the HUD: the map, the clock with the weather, and the sound's switch. */
function Sky() {
  const t = useTranslations("Island");
  const muted = useGame((state) => state.muted);
  const setMuted = useGame((state) => state.setMuted);
  const setSheet = useGame((state) => state.setSheet);
  return (
    <div
      className={panelVariants({
        className: "grid shrink-0 grid-cols-2 items-center p-1 sm:flex",
      })}
    >
      <Button
        aria-haspopup="dialog"
        className="size-11"
        onClick={() => setSheet("map")}
        size="icon"
        tooltip={t("map")}
        variant="ghost"
      >
        <HugeIcons icon={MapsIcon} />
      </Button>
      <Clock />
      <Button
        aria-pressed={muted}
        className="size-11"
        onClick={() => {
          setMuted(!muted);
          writeMuted(!muted);
        }}
        size="icon"
        tooltip={t("mute")}
        variant="ghost"
      >
        <HugeIcons icon={muted ? VolumeOffIcon : VolumeHighIcon} />
      </Button>
    </div>
  );
}

/** The HUD's top row (ADR 0050, W7): identity and Stars at the left, the map, the clock and the weather at the right. */
export function IslandStatus() {
  return (
    <header className="sideways:col-start-2 col-start-1 row-start-1 flex w-full items-start justify-between gap-2">
      <Identity />
      <Sky />
    </header>
  );
}
