import { Clock04Icon, PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { Choice } from "@repo/design-system/components/contents/mathematics/choice";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  VisualCardActions,
  VisualCardFullscreen,
  VisualCardGroup,
} from "@repo/design-system/components/visual/card";
import { Array as Arr, Schema } from "effect";
import { createContext, type ReactNode, use } from "react";
import { useTranslations } from "use-intl";

const SPEED_STEP = 0.25;
const SPEED_VALUES = Array.from(
  { length: 5 },
  (_, index) => SPEED_STEP * (index + 1)
);

/** Renders the reset, playback, and full screen actions in the card's actions band. */
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
      <Button onClick={onReset} size="icon" variant="outline">
        <HugeIcons icon={Clock04Icon} />
        <span className="sr-only">{t("reset")}</span>
      </Button>
      <Button
        onClick={onTogglePlaying}
        size="icon"
        variant={isPlaying ? "outline" : "default"}
      >
        <HugeIcons icon={isPlaying ? PauseIcon : PlayIcon} />
        <span className="sr-only">{t(isPlaying ? "pause" : "play")}</span>
      </Button>
      <VisualCardFullscreen />
    </VisualCardActions>
  );
}

/** Renders one choice per playback speed. */
export function BacterialSpeeds({
  onSpeedChange,
  speed,
}: {
  onSpeedChange: (speed: number) => void;
  speed: number;
}) {
  return (
    <VisualCardGroup>
      {Arr.map(SPEED_VALUES, (speedValue) => (
        <Choice
          key={speedValue}
          onClick={() => onSpeedChange(speedValue)}
          pressed={speed === speedValue}
        >
          {speedValue}x
        </Choice>
      ))}
    </VisualCardGroup>
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

/** Renders one choice per generation, labelled with its time. */
export function BacterialGenerations({
  generation,
  maxGenerations,
  onGenerationChange,
}: {
  generation: number;
  maxGenerations: number;
  onGenerationChange: (generation: number) => void;
}) {
  const { timeInterval, timeUnit } = useBacterialTime();

  return (
    <VisualCardGroup>
      {Array.from({ length: maxGenerations + 1 }, (_, index) => {
        const time = index * timeInterval;

        return (
          <Choice
            key={time.toString()}
            onClick={() => onGenerationChange(index)}
            pressed={generation === index}
          >
            {time} {timeUnit}
          </Choice>
        );
      })}
    </VisualCardGroup>
  );
}
