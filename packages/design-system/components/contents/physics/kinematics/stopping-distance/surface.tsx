import { useFrame } from "@react-three/fiber";
import { FollowCamera } from "@repo/design-system/components/contents/physics/kinematics/follow";
import {
  DistancePosts,
  ROAD,
  Road,
  SkidMarks,
  type SkidRig,
} from "@repo/design-system/components/contents/physics/kinematics/road";
import {
  SEDAN,
  Sedan,
  type SedanRig,
} from "@repo/design-system/components/contents/physics/kinematics/sedan";
import {
  decelerationOf,
  frictionOf,
  isSurface,
  SURFACES,
  type Surface,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/friction";
import {
  brakingDistance,
  brakingTime,
  type Stop,
  stopPosition,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/motion";
import {
  UNIT,
  useQuantity,
} from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr, Schema } from "effect";
import {
  type ReactNode,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

/** The speed every surface is tested from: 20 m/s, 72 km/h. */
const SPEED = 20;

/** The seconds of driving shown before the brakes bite at the line. */
const LEAD_IN = 1.6;

/** The camera rides 5.5 m behind, 2.1 m up and 8.5 m beside the car. */
const CAMERA_OFFSET = [-5.5, 2.1, 8.5] as const;

/** The colour and strength of the marks locked tyres leave. */
const SkidLookSchema = Schema.Struct({
  color: Schema.String,
  opacity: Schema.Finite,
});

/** The marks locked tyres leave on each surface. */
const SKID = {
  dry: { color: MATERIAL.skidRubber, opacity: 0.85 },
  gravel: { color: MATERIAL.gravelGroove, opacity: 0.75 },
  ice: { color: MATERIAL.icePolish, opacity: 0.45 },
  snow: { color: MATERIAL.snowTrack, opacity: 0.7 },
  wet: { color: MATERIAL.skidRubber, opacity: 0.5 },
} satisfies Record<Surface, typeof SkidLookSchema.Type>;

/**
 * A car at 20 m/s locks its wheels at the white line on the road surface the
 * learner picks: dry or wet asphalt, gravel, packed snow or ice. The tyres
 * slide, so friction alone stops the car with b = μg, and the skid marks and
 * the distance posts show d = v²/(2b) on the real road.
 */
export function BrakingSurfaceLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly brakingDistance: ReactNode;
    readonly brakingTime: ReactNode;
    readonly chooseSurface: string;
    readonly deceleration: ReactNode;
    readonly friction: ReactNode;
    readonly surfaces: Readonly<Record<Surface, string>>;
    readonly viewLabel: string;
  };
  readonly title: ReactNode;
}) {
  const [surface, setSurface] = useState<Surface>("dry");
  const quantity = useQuantity();
  const stop = useMemo<Stop>(
    () => ({
      deceleration: decelerationOf(surface),
      reaction: 0,
      speed: SPEED,
    }),
    [surface]
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseSurface}
          onValueChange={(value: string) => {
            if (isSurface(value)) {
              setSurface(value);
            }
          }}
          type="single"
          value={surface}
          variant="outline"
        >
          {Arr.map(SURFACES, (each) => (
            <ToggleGroupItem key={each} value={each}>
              {labels.surfaces[each]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={30} setting="field">
          <Suspense fallback={null}>
            <SurfaceScene stop={stop} surface={surface} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.friction}
            value={<InlineMath math={quantity(frictionOf(surface), "", 2)} />}
          />
          <VisualFactTabular
            label={labels.deceleration}
            value={
              <InlineMath
                math={quantity(stop.deceleration, UNIT.acceleration, 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.brakingDistance}
            value={
              <InlineMath math={quantity(brakingDistance(stop), UNIT.length)} />
            }
          />
          <VisualFactTabular
            label={labels.brakingTime}
            value={<InlineMath math={quantity(brakingTime(stop), UNIT.time)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** Where the car is `time` seconds after its brakes locked at the line. */
function carAt(stop: Stop, time: number) {
  return time < 0 ? stop.speed * time : stopPosition(stop, time);
}

/** The distance posts that mark the slide: every 10 m, then every 50 m. */
function postsFor(distance: number) {
  const near = Arr.map(Arr.range(1, 6), (index) => index * 10);
  const far = Arr.map(
    Arr.range(2, Math.max(2, Math.ceil(distance / 50))),
    (index) => index * 50
  );
  return Arr.dedupe(Arr.appendAll(near, distance > 60 ? far : []));
}

/** The road, the car and its skid marks, run by the card's play clock. */
function SurfaceScene({
  stop,
  surface,
}: {
  readonly stop: Stop;
  readonly surface: Surface;
}) {
  const car = useRef<SedanRig>(null);
  const marks = useRef<SkidRig>(null);
  const shown = useRef(brakingDistance(stop));
  const distance = brakingDistance(stop);
  const { advance, playing } = useTimeline(-LEAD_IN, brakingTime(stop));

  // The scene moves before the camera that follows it reads where it is.
  useFrame((_, delta) => {
    const time = advance(delta);
    const x = carAt(stop, time);
    shown.current = x;
    car.current?.place(x, time >= 0 && time < brakingTime(stop));
    marks.current?.draw(0, Math.max(0, x));
  }, -1);

  const follow = useCallback(() => shown.current, []);

  return (
    <>
      <SimulationTicker running={playing} />
      <FollowCamera
        depth={ROAD.lane}
        follow={follow}
        lookAhead={2}
        maxDistance={60}
        minDistance={6}
        offset={CAMERA_OFFSET}
      />
      <Road from={-300} surface={surface} to={distance + 600} />
      <DistancePosts posts={postsFor(distance)} />
      <group position={[0, 0, ROAD.lane]}>
        <Sedan color={MATERIAL.carPaint} ref={car} />
      </group>
      <SkidMarks
        color={SKID[surface].color}
        opacity={SKID[surface].opacity}
        rear={SEDAN.rearAxle}
        ref={marks}
        track={SEDAN.track}
      />
    </>
  );
}
