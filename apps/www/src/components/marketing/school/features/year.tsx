import {
  Analytics01Icon,
  Certificate01Icon,
  MessageMultiple01Icon,
  MortarboardIcon,
  Task01Icon,
  TaskEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { cva } from "class-variance-authority";
import { Array as Arr, Match } from "effect";
import type { AnimationSequence } from "motion";
import { useTranslations } from "use-intl";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import {
  FlowDot,
  FlowNode,
  FlowParcel,
  FlowStage,
  FlowWires,
  useFlowPlay,
} from "@/components/marketing/school/flow/stage";
import {
  type Size,
  travel,
  wire,
} from "@/components/marketing/school/flow/wire";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";

/** The middle of the stage, where Nakafa School stands. */
const HUB = { x: 50, y: 50 };

/** The rows that the parts of a school year stand in, on both sides of the hub. */
const ROWS = [14, 50, 86] as const;

/**
 * What a school runs through one year, in the order it happens: the three
 * that feed the system stand at its start side, and the three it gives back
 * at its end side. Each icon is the one the School app draws for that page.
 */
const PARTS = [
  { icon: MessageMultiple01Icon, key: "classes", side: "in", tone: "blue" },
  { icon: Task01Icon, key: "tasks", side: "in", tone: "yellow" },
  { icon: TaskEdit01Icon, key: "exams", side: "in", tone: "orange" },
  { icon: Certificate01Icon, key: "reports", side: "out", tone: "green" },
  { icon: Analytics01Icon, key: "insight", side: "out", tone: "cream" },
  { icon: MortarboardIcon, key: "graduation", side: "out", tone: "red" },
] as const;

/** The tile behind a part's icon, each part in a colour of Nina's own things, so the six read apart at a glance. */
const toneVariants = cva(
  "text-nina-ink grid size-8 shrink-0 place-items-center rounded-lg sm:size-10",
  {
    variants: {
      tone: {
        blue: "bg-pop-blue",
        cream: "bg-pop-cream",
        green: "bg-pop-green",
        orange: "bg-pop-orange",
        red: "bg-pop-red",
        yellow: "bg-pop-yellow",
      },
    },
  }
);

/** Every part at its place, with the wire between it and the hub in the direction its work flows. */
const NODES = Arr.map(PARTS, (part, index) => {
  const at = {
    x: part.side === "in" ? 13 : 87,
    y: Arr.getUnsafe(ROWS, index % ROWS.length),
  };
  return {
    ...part,
    at,
    name: part.key,
    path: part.side === "in" ? wire(at, HUB, "row") : wire(HUB, at, "row"),
  };
});

/** The beat of the hub when work reaches it. */
const BEAT = { scale: [1, 1.06, 1] };

/**
 * The story of the year picture, six seconds long, which is one turn of the
 * year round Nakafa School: the work of classes, tasks and exams flows in, the
 * school beats, and report cards, insight and graduation come out, each part
 * beating as it is reached.
 */
function composeYear(
  stage: HTMLElement,
  size: typeof Size.Type
): AnimationSequence {
  const all = (selector: string) => stage.querySelectorAll(selector);

  return [
    ...Arr.flatMap(NODES, ({ name, path, side }, index): AnimationSequence => {
      const start =
        side === "in" ? 0.4 + index * 0.25 : 2.6 + (index - 3) * 0.25;
      return [
        [
          all(`[data-parcel="${name}"]`),
          travel(path, size),
          { at: start, duration: 0.9, ease: "linear" },
        ],
        [
          all(`[data-parcel="${name}"]`),
          { opacity: [0, 1] },
          { at: start, duration: 0.12 },
        ],
        [
          all(`[data-wire="${name}"]`),
          { opacity: [0, 0.5, 0] },
          { at: start, duration: 0.9 },
        ],
        [
          all(`[data-parcel="${name}"]`),
          { opacity: 0 },
          { at: start + 0.84, duration: 0.1 },
        ],
        [
          all(side === "in" ? "[data-hub]" : `[data-part="${name}"]`),
          BEAT,
          { at: start + 0.86, duration: 0.4 },
        ],
      ];
    }),
    [
      all("[data-orbit]"),
      { rotate: [0, 360] },
      { at: 0, duration: 6, ease: "linear" },
    ],
  ];
}

/** The name of one part of the year, read from the key that owns its word. */
function PartName({ part }: { part: (typeof NODES)[number]["key"] }) {
  const t = useTranslations("SchoolSite");
  const tCommon = useTranslations("Common");
  const tExams = useTranslations("Exams");
  const tClassroom = useTranslations("Classroom");
  return Match.value(part).pipe(
    Match.when("classes", () => tCommon("classes")),
    Match.when("tasks", () => tClassroom("tabs-tasks")),
    Match.when("exams", () => tExams("title")),
    Match.when("reports", () => tCommon("report-cards")),
    Match.when("insight", () => t("year-insight")),
    Match.when("graduation", () => tCommon("graduation")),
    Match.exhaustive
  );
}

/** One part of the school year: its icon and its name, upright on a phone and in one line from there. */
function Part({ index }: { index: number }) {
  const { at, icon, key, tone } = Arr.getUnsafe(NODES, index);

  return (
    <FlowNode anchor="middle" at={at}>
      <div
        className="bg-card ring-foreground/10 flex min-h-20 w-22 flex-col items-center justify-center gap-1.5 rounded-xl p-2 text-center text-xs font-medium shadow-xs ring-1 sm:min-h-0 sm:w-auto sm:flex-row sm:gap-3 sm:py-2 sm:ps-2 sm:pe-5 sm:text-base sm:whitespace-nowrap"
        data-part={key}
      >
        <span className={toneVariants({ tone })}>
          <HugeIcons icon={icon} />
        </span>
        <PartName part={key} />
      </div>
    </FlowNode>
  );
}

/**
 * The year part: under Nina and her words, Nakafa School in the middle of
 * what a school runs through one year. Classes, tasks and exams flow into it,
 * and report cards, insight and graduation come out of it: one system.
 */
export function SchoolYear() {
  const t = useTranslations("SchoolSite");
  const stage = useFlowPlay(composeYear);

  return (
    <FeatureRow id="year" layout="wide">
      <SchoolFeatureText feature="year">
        <Nina act="graduating" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureProduct>
        <FlowStage
          className="aspect-square max-w-4xl sm:aspect-2/1"
          label={t("year-picture")}
          ref={stage}
        >
          <FlowWires wires={NODES} />
          {Arr.map(NODES, ({ name }, index) => (
            <Part index={index} key={name} />
          ))}
          <FlowNode anchor="middle" at={HUB}>
            <div className="relative grid place-items-center">
              <div className="absolute -inset-5 rounded-full border border-dashed sm:-inset-10" />
              <div className="absolute -inset-5 sm:-inset-10" data-orbit="">
                <div className="bg-foreground absolute top-0 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full" />
              </div>
              <div
                className="bg-card ring-foreground/10 grid aspect-square w-24 place-content-center justify-items-center gap-2 rounded-full text-center text-xs font-medium shadow-xs ring-1 sm:w-40 sm:text-base"
                data-hub=""
              >
                <img
                  alt=""
                  className="rounded-sm border"
                  height={40}
                  src="/logo.svg"
                  width={40}
                />
                Nakafa School
              </div>
            </div>
          </FlowNode>
          {Arr.map(NODES, ({ name }) => (
            <FlowParcel key={name} name={name}>
              <FlowDot />
            </FlowParcel>
          ))}
        </FlowStage>
      </FeatureProduct>
    </FeatureRow>
  );
}
