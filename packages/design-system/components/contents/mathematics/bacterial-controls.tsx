import {
  Clock04Icon,
  DashboardSpeed01Icon,
  PauseIcon,
  PlayIcon,
  Time04Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  VisualCardActions,
  VisualCardMenu,
} from "@repo/design-system/components/visual/card";
import { Array as Arr, Schema } from "effect";
import { createContext, type ReactNode, use } from "react";
import { useTranslations } from "use-intl";

const SPEED_STEP = 0.25;
const SPEED_VALUES = Arr.makeBy(5, (index) => SPEED_STEP * (index + 1));

/**
 * Renders the card's actions band: play or pause, its one main action, then full
 * screen joined with the menu that starts the growth over.
 */
export function BacterialPlayback({
  isPlaying,
  onReset,
  onTogglePlaying,
}: {
  isPlaying: boolean;
  onReset: () => void;
  onTogglePlaying: () => void;
}) {
  const t = useTranslations("Common");

  return (
    <VisualCardActions>
      <Button
        onClick={onTogglePlaying}
        size="icon"
        variant={isPlaying ? "outline" : "default"}
      >
        <HugeIcons icon={isPlaying ? PauseIcon : PlayIcon} />
        <span className="sr-only">{t(isPlaying ? "pause" : "play")}</span>
      </Button>
      <VisualCardMenu>
        <DropdownMenuItem onClick={onReset}>
          <HugeIcons icon={Clock04Icon} />
          {t("reset")}
        </DropdownMenuItem>
      </VisualCardMenu>
    </VisualCardActions>
  );
}

/**
 * Renders the playback speed as one select, which names the speed it plays at. It keeps the width of its widest
 * speed, so a new speed moves nothing beside it.
 */
export function BacterialSpeeds({
  onSpeedChange,
  speed,
}: {
  onSpeedChange: (speed: number) => void;
  speed: number;
}) {
  const t = useTranslations("Common");
  const items = Arr.map(SPEED_VALUES, (value) => ({
    label: `${value}x`,
    value,
  }));

  return (
    <Select
      items={items}
      onValueChange={(next: number | null) => {
        if (next !== null) {
          onSpeedChange(next);
        }
      }}
      value={speed}
    >
      <SelectTrigger aria-label={t("speed")} size="sm">
        <HugeIcons
          className="text-muted-foreground"
          icon={DashboardSpeed01Icon}
        />
        <SelectValue labels={Arr.map(items, (item) => item.label)} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{t("speed")}</SelectLabel>
          {Arr.map(items, (item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** The time that one growth card labels its generations with. */
const BacterialTimeSchema = Schema.Struct({
  timeInterval: Schema.Finite,
  timeUnit: Schema.String,
});

type BacterialTime = typeof BacterialTimeSchema.Type;

const BacterialTimeContext = createContext<BacterialTime | null>(null);

/** Provides the time that one growth card labels its generations with. */
export function BacterialTimeProvider({
  children,
  time,
}: {
  children: ReactNode;
  time: BacterialTime;
}) {
  return <BacterialTimeContext value={time}>{children}</BacterialTimeContext>;
}

/** Reads the time that the surrounding growth card labels its generations with. */
function useBacterialTime() {
  const time = use(BacterialTimeContext);
  if (!time) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error(
      "useBacterialTime must be used within BacterialTimeProvider"
    );
  }
  return time;
}

/**
 * Renders the generation as one select, each option labelled with its time. The
 * select follows the growth as it advances on its own, and a choice jumps to it.
 * It keeps the width of its longest time, so the growth never widens it and
 * moves nothing beside it while no one touches the card.
 */
export function BacterialGenerations({
  generation,
  maxGenerations,
  onGenerationChange,
}: {
  generation: number;
  maxGenerations: number;
  onGenerationChange: (generation: number) => void;
}) {
  const t = useTranslations("Common");
  const { timeInterval, timeUnit } = useBacterialTime();
  const items = Arr.makeBy(maxGenerations + 1, (index) => ({
    label: `${index * timeInterval} ${timeUnit}`,
    value: index,
  }));

  return (
    <Select
      items={items}
      onValueChange={(next: number | null) => {
        if (next !== null) {
          onGenerationChange(next);
        }
      }}
      value={generation}
    >
      <SelectTrigger aria-label={t("time")} size="sm">
        <HugeIcons className="text-muted-foreground" icon={Time04Icon} />
        <SelectValue labels={Arr.map(items, (item) => item.label)} />
      </SelectTrigger>
      <SelectContent>
        {Arr.map(items, (item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
