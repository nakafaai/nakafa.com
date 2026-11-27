import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { VelocityArrow } from "@repo/design-system/components/contents/physics/kinematics/arrow";
import { grainTexture } from "@repo/design-system/components/contents/physics/kinematics/grain";
import { paintFrost } from "@repo/design-system/components/contents/physics/kinematics/sling/frost";
import {
  CurlingStone,
  STONE,
} from "@repo/design-system/components/contents/physics/kinematics/sling/stone";
import type { ReleasePoint } from "@repo/design-system/components/contents/physics/kinematics/sling/whirl";
import {
  RELEASE_ANGLES,
  ReleasePointSchema,
  releaseTime,
  slingPlace,
  whirl,
} from "@repo/design-system/components/contents/physics/kinematics/sling/whirl";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
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
import { getColor } from "@repo/design-system/lib/color";
import { RINK_COLORS } from "@repo/design-system/lib/material/rink";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
} from "three";

/** How long the freed stone is followed after release, in seconds. */
const FLIGHT_SECONDS = 0.5;

/** Simulated seconds per wall second: the whirl is slowed so the release can be seen. */
const PLAY_RATE = 0.4;

/** How high over the ice the arrows are drawn, in metres. */
const ARROWS = 0.3;

interface StringWhirlReleaseLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    acceleration: ReactNode;
    chooseRelease: string;
    period: ReactNode;
    radius: ReactNode;
    releases: Record<ReleasePoint, ReactNode>;
    speed: ReactNode;
    viewLabel: string;
  };
  /** The time for one turn, in seconds. */
  period: number;
  /** The length of the string, in metres. */
  radius: number;
  title: NonNullable<ReactNode>;
}

/**
 * A stone whirled on a string over smooth ice, let go at a point the
 * learner picks. While it turns, its velocity (teal) stays tangent and its
 * acceleration (fuchsia) points to the centre; once let go, nothing pulls it
 * in, so it slides straight along the tangent of the point of release.
 */
export function StringWhirlReleaseLab({
  description,
  labels,
  period,
  radius,
  title,
}: StringWhirlReleaseLabProps) {
  const [release, setRelease] = useState<ReleasePoint>("north");
  const quantity = useQuantity();
  const motion = whirl(radius, period);
  const isRelease = Schema.is(ReleasePointSchema);

  return (
    <VisualCard
      onReset={() => {
        setRelease("north");
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseRelease}
          gridColumns="4"
          onValueChange={(value) => {
            if (isRelease(value)) {
              setRelease(value);
            }
          }}
          type="single"
          value={release}
          variant="outline"
        >
          {Arr.map(ReleasePointSchema.literals, (point) => (
            <ToggleGroupItem key={point} value={point}>
              {labels.releases[point]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage
          floor={0}
          ground="snow"
          reach={radius * 5}
          setting="field"
        >
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[radius * 0.9, radius * 1.7, radius * 3.3]}
              cameraTarget={[-radius * 0.3, 0.1, -radius * 0.2]}
              fov={40}
              maxPolarAngle={Math.PI / 2 - 0.1}
            />
            <WhirlScene period={period} radius={radius} release={release} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.radius}
            value={<InlineMath math={quantity(radius, "\\text{ m}", 2)} />}
          />
          <VisualFactTabular
            label={labels.period}
            value={<InlineMath math={quantity(period, "\\text{ s}", 2)} />}
          />
          <VisualFactTabular
            label={labels.speed}
            value={
              <InlineMath math={quantity(motion.speed, "\\text{ m/s}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.acceleration}
            value={
              <InlineMath
                math={quantity(motion.acceleration, "\\text{ m/s}^2", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** Pixels along each side of the frost tile, and the metres of ice one tile covers. */
const FROST = 512;
const FROST_TILE = 7;

/**
 * The frozen pond the stone slides on: pebbled ice, glossy where it is
 * clear and dull where frost has drifted over it, crossed by fine cracks,
 * lying in the snow that the stage spreads around it.
 */
function Ice({ radius }: { readonly radius: number }) {
  const wide = radius * 9;
  const maps = useMemo(() => {
    const pebble = grainTexture(1.2);
    pebble.repeat.set(wide * 5, wide * 5);
    const frost = new DataTexture(paintFrost(FROST), FROST, FROST);
    frost.wrapS = RepeatWrapping;
    frost.wrapT = RepeatWrapping;
    frost.repeat.set((2 * wide) / FROST_TILE, (2 * wide) / FROST_TILE);
    frost.magFilter = LinearFilter;
    frost.minFilter = LinearMipmapLinearFilter;
    frost.generateMipmaps = true;
    frost.needsUpdate = true;
    return { frost, pebble };
  }, [wide]);
  useEffect(
    () => () => {
      maps.frost.dispose();
      maps.pebble.dispose();
    },
    [maps]
  );

  return (
    <CameraBounds exclude>
      <mesh
        position={[0, 0.001, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[wide, 96]} />
        <meshPhysicalMaterial
          bumpMap={maps.pebble}
          bumpScale={0.3}
          clearcoat={1}
          clearcoatRoughness={0.08}
          color={RINK_COLORS.ice}
          map={maps.frost}
          roughness={0.55}
          roughnessMap={maps.frost}
        />
      </mesh>
    </CameraBounds>
  );
}

/**
 * The ice with the stake the string turns on, the circle the stone keeps to
 * scribed into it, the tangent at the point of release, and the stone on
 * its string with its velocity and its acceleration. East is +x and north
 * runs away from the camera.
 */
function WhirlScene({
  period,
  radius,
  release,
}: {
  readonly period: number;
  readonly radius: number;
  readonly release: ReleasePoint;
}) {
  const quantity = useQuantity();
  const stone = useRef<Group>(null);
  const string = useRef<Group>(null);
  const velocity = useRef<Group>(null);
  const pull = useRef<Group>(null);
  const end = releaseTime(period, release) + FLIGHT_SECONDS;
  const { advance, playing } = useTimeline(0, end / PLAY_RATE);
  const motion = whirl(radius, period);
  const letGo = RELEASE_ANGLES[release];
  const speedArrow = useMemo(
    () => [motion.speed * radius * 0.11, 0, 0] as const,
    [motion.speed, radius]
  );
  const pullArrow = useMemo(() => [radius * 0.6, 0, 0] as const, [radius]);
  const tangent = useMemo(
    () =>
      [
        [radius * Math.cos(letGo), 0.004, -radius * Math.sin(letGo)],
        [
          radius * Math.cos(letGo) - radius * 5 * Math.sin(letGo),
          0.004,
          -radius * Math.sin(letGo) - radius * 5 * Math.cos(letGo),
        ],
      ] as const,
    [letGo, radius]
  );

  useFrame((_, delta) => {
    const now = advance(delta) * PLAY_RATE;
    const place = slingPlace(radius, period, release, now);
    const around = place.released ? letGo : Math.atan2(place.y, place.x);
    stone.current?.position.set(place.x, 0, -place.y);
    stone.current?.rotation.set(0, around + Math.PI, 0);
    string.current?.position.set(place.x, STONE.eye, -place.y);
    string.current?.rotation.set(
      0,
      place.released ? letGo - Math.PI / 2 : around + Math.PI,
      place.released ? -Math.asin((STONE.eye - 0.01) / radius) : 0
    );
    velocity.current?.position.set(place.x, ARROWS, -place.y);
    velocity.current?.rotation.set(0, around + Math.PI / 2, 0);
    pull.current?.position.set(place.x, ARROWS, -place.y);
    pull.current?.rotation.set(0, around + Math.PI, 0);
    if (pull.current) {
      pull.current.visible = !place.released;
    }
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <Ice radius={radius} />
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.007, radius + 0.007, 160]} />
        <meshStandardMaterial
          color={RINK_COLORS.scribe}
          opacity={0.75}
          roughness={0.6}
          transparent
        />
      </mesh>
      <Line
        color={PLOT_COLORS.teal}
        dashed
        dashSize={radius * 0.09}
        gapSize={radius * 0.07}
        lineWidth={2}
        opacity={0.7}
        points={tangent}
        transparent
      />
      <mesh castShadow position={[0, 0.006, 0]} receiveShadow>
        <cylinderGeometry args={[0.045, 0.052, 0.012, 32]} />
        <SurfaceMaterial
          color={RINK_COLORS.steel}
          metalness={0.85}
          repeat={[1, 1]}
          roughness={0.4}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow position={[0, (STONE.eye + 0.02) / 2, 0]}>
        <cylinderGeometry args={[0.011, 0.013, STONE.eye + 0.02, 20]} />
        <SurfaceMaterial
          color={RINK_COLORS.steel}
          metalness={0.85}
          repeat={[1, 2]}
          roughness={0.35}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow position={[0, STONE.eye + 0.022, 0]}>
        <sphereGeometry args={[0.017, 20, 14]} />
        <SurfaceMaterial
          color={RINK_COLORS.steel}
          metalness={0.9}
          repeat={[1, 1]}
          roughness={0.25}
          surface="brushed"
        />
      </mesh>
      <group ref={string}>
        <mesh
          castShadow
          position={[radius / 2, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.0045, 0.0045, radius, 8]} />
          <SurfaceMaterial
            color={RINK_COLORS.rope}
            repeat={[1, 30]}
            roughness={0.9}
            surface="cloth"
          />
        </mesh>
      </group>
      <group ref={stone}>
        <CurlingStone />
      </group>
      <group ref={velocity}>
        <VelocityArrow
          color={PLOT_COLORS.teal}
          from={ORIGIN}
          thick={radius * 0.016}
          to={speedArrow}
        />
        <ThreeLabel
          color={PLOT_COLORS.teal}
          fontSize="compact"
          outlineColor={getColor("SLATE", 50)}
          outlineWidth={0.05}
          position={[speedArrow[0], 0.14, 0]}
        >
          <InlineMath
            math={`v=${quantity(motion.speed, "\\text{ m/s}", 2)}`}
          />
        </ThreeLabel>
      </group>
      <group ref={pull}>
        <VelocityArrow
          color={PLOT_COLORS.fuchsia}
          from={ORIGIN}
          thick={radius * 0.016}
          to={pullArrow}
        />
        <ThreeLabel
          color={PLOT_COLORS.fuchsia}
          fontSize="compact"
          outlineColor={getColor("SLATE", 50)}
          outlineWidth={0.05}
          position={[pullArrow[0] * 0.5, 0.16, 0]}
        >
          <InlineMath
            math={`a=${quantity(motion.acceleration, "\\text{ m/s}^2", 1)}`}
          />
        </ThreeLabel>
      </group>
    </>
  );
}

/** The foot of an arrow in its own frame. */
const ORIGIN = [0, 0, 0] as const;
