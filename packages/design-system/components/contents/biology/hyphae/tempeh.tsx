import type { Segment } from "@repo/design-system/components/contents/biology/hyphae/growth";
import {
  coverOf,
  growOf,
  lengthOf,
  SegmentSchema,
  sporesOf,
  TEMPEH,
} from "@repo/design-system/components/contents/biology/hyphae/growth";
import { TempehScene } from "@repo/design-system/components/contents/biology/hyphae/scene";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";

/** Growth is worked out a quarter of an hour at a time. */
const STEP_HOURS = 0.25;

/** Spores sown on the tray. */
const SPORES = 14;

/** The squares the tray is split into to measure how much the mould covers. */
const COVER_CELLS = 24;

/** How far the lab reaches from the tray's middle, in metres. */
const REACH = 0.04;

/** The height of the table the leaf lies on, just under the leaf's lowest fold, in metres. */
const TABLE = -0.0003;

/** One quarter-hour of growth: the hyphae laid so far and the tips growing. */
const StageSchema = Schema.Struct({
  hours: Schema.Finite,
  segments: Schema.Array(SegmentSchema),
  tips: Schema.Finite,
});
type Stage = typeof StageSchema.Type;

/**
 * Tempeh in the making on its banana leaf: cooked soybean halves sown with
 * Rhizopus spores at 30 °C. Each spore grows a hypha whose tip moves on and
 * branches, the threads spread between the beans and digest them, and by
 * about a day and a half a white mycelium binds the beans into one cake. The
 * reader scrubs the hours; the footer reads the hyphae's total length, the
 * tips and the share of the tray covered.
 */
export function HyphaeDecayLab({
  description,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly cover: ReactNode;
    readonly hours: string;
    readonly length: ReactNode;
    readonly tips: ReactNode;
    readonly time: ReactNode;
    readonly viewLabel: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [hours, setHours] = useState<number>(TEMPEH.hours);
  const quantity = useQuantity();
  const stages = useMemo(() => growthOf(), []);
  const laid = useMemo(() => laidOf(stages), [stages]);
  const stage =
    stages[Math.min(stages.length - 1, Math.round(hours / STEP_HOURS))];
  const segments = stage?.segments ?? [];
  const whole = Arr.last(stages);

  return (
    <VisualCard
      onReset={() => {
        setHours(TEMPEH.hours);
      }}
      onStop={() => {
        setHours(0);
      }}
    >
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.hours}</span>
            <span className="tabular-nums">
              {Math.round(hours)}/{TEMPEH.hours}
            </span>
          </div>
          <Slider
            aria-label={labels.hours}
            max={TEMPEH.hours}
            min={0}
            onValueChange={setHours}
            step={STEP_HOURS}
            value={hours}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={TABLE} ground="oak" reach={REACH} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.004, 0.044, 0.03]}
              cameraTarget={[0, 0.001, 0]}
              fov={36}
              framing="content"
              projection={{ kind: "perspective", near: 0.002 }}
            />
            <TempehScene
              cover={coverOf(segments, COVER_CELLS)}
              hours={hours}
              laid={laid}
              onHours={setHours}
              segments={Option.match(whole, {
                onNone: () => segments,
                onSome: (last) => last.segments,
              })}
              shown={segments.length}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.time}
            value={<InlineMath math={quantity(hours, "\\text{ h}", 0)} />}
          />
          <VisualFactTabular
            label={labels.length}
            value={
              <InlineMath
                math={quantity(lengthOf(segments) / 10, "\\text{ cm}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.tips}
            value={<InlineMath math={quantity(stage?.tips ?? 0, "", 0)} />}
          />
          <VisualFactTabular
            label={labels.cover}
            value={
              <InlineMath
                math={quantity(coverOf(segments, COVER_CELLS) * 100, "\\%", 0)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** The whole 36 hours of growth, a quarter-hour at a time, worked out once. */
function growthOf(): readonly Stage[] {
  const steps = Math.round(TEMPEH.hours / STEP_HOURS);
  return Arr.scan(
    Arr.range(1, steps),
    {
      hours: 0,
      live: sporesOf(SPORES),
      segments: Arr.empty<Segment>(),
      tips: SPORES,
    },
    (stage, step) => {
      const grown = growOf(stage.live, STEP_HOURS, step);
      return {
        hours: step * STEP_HOURS,
        live: grown.tips,
        segments: Arr.appendAll(stage.segments, grown.segments),
        tips: grown.tips.length,
      };
    }
  );
}

/**
 * The hour each stretch of hypha was laid, in the order they were laid: each
 * quarter-hour adds its stretches after those of the quarter-hours before.
 */
function laidOf(stages: readonly Stage[]) {
  return Arr.flatMap(stages, (stage, index) =>
    Arr.replicate(
      stage.hours,
      stage.segments.length - (stages[index - 1]?.segments.length ?? 0)
    )
  );
}
