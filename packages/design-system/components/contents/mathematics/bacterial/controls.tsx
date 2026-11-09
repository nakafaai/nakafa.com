import { DashboardSpeed01Icon, Time04Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useRequired } from "@repo/design-system/hooks/required";
import { Array as Arr, Schema } from "effect";
import { type ComponentProps, createContext, type ReactNode } from "react";
import { useTranslations } from "use-intl";

const SPEED_STEP = 0.25;
const SPEED_VALUES = Arr.makeBy(5, (index) => SPEED_STEP * (index + 1));

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
      <BacterialSelectParts
        icon={DashboardSpeed01Icon}
        items={items}
        label={t("speed")}
        menu={t("menu-speed")}
      />
    </Select>
  );
}

/**
 * The trigger and the list of one select of the growth card's toolbar: the icon of what it chooses, the chosen value
 * at the width of its widest label, and its labelled list, each option with the same icon.
 */
function BacterialSelectParts({
  icon,
  items,
  label,
  menu,
}: {
  icon: ComponentProps<typeof HugeIcons>["icon"];
  items: readonly { readonly label: string; readonly value: number }[];
  /** The name of the select for assistive technology. */
  label: string;
  /** The one word above the list. */
  menu: string;
}) {
  return (
    <>
      <SelectTrigger aria-label={label} size="sm">
        <HugeIcons className="text-muted-foreground" icon={icon} />
        <SelectValue labels={Arr.map(items, (item) => item.label)} />
      </SelectTrigger>
      <SelectContent label={menu}>
        {Arr.map(items, (item) => (
          <SelectItem icon={icon} key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </>
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
  return useRequired(BacterialTimeContext, "useBacterialTime");
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
      <BacterialSelectParts
        icon={Time04Icon}
        items={items}
        label={t("time")}
        menu={t("menu-time")}
      />
    </Select>
  );
}
