import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { createEpoxyTexture } from "@repo/design-system/components/contents/chemistry/glassware";
import type { RampAngle } from "@repo/design-system/components/contents/physics/kinematics/galileo/ramp";
import {
  BELLS,
  bellGaps,
  bellPlaces,
  RampAngleSchema,
  rampAcceleration,
  rampDistance,
} from "@repo/design-system/components/contents/physics/kinematics/galileo/ramp";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import {
  isNarrowThreeScene,
  threeSceneFrameVariants,
} from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  useVisualReset,
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
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type { ReactNode, Ref } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Group, MeshStandardMaterial } from "three";
import { DoubleSide, Vector2 } from "three";

/** The ramp board: its length along the slope, width, thickness, and the ball's radius, in metres. */
const BOARD = { length: 4.4, thickness: 0.08, width: 0.24 } as const;
const BALL = 0.042;

/** How long after the ball passes a bell it keeps glowing, in seconds. */
const RING = 0.38;

/** Flared Renaissance brass bell dome profile for LatheGeometry. */
const BELL_PROFILE = Arr.map(
  [
    [0.004, 0.068],
    [0.022, 0.064],
    [0.032, 0.048],
    [0.038, 0.022],
    [0.048, 0.004],
    [0.052, 0],
  ] as const,
  ([r, y]) => new Vector2(r, y)
);

/** The point at the top of the ramp where the ball starts, and the unit vector down the slope. */
function rampFrame(angle: number) {
  const tilt = (angle * Math.PI) / 180;
  const half = BOARD.length / 2;
  return {
    down: { x: Math.cos(tilt), y: -Math.sin(tilt) },
    tilt,
    top: { x: -half * Math.cos(tilt), y: 0.08 + BOARD.length * Math.sin(tilt) },
  };
}

/** Satin laboratory benchtop, mahogany-grained grooved ramp with brass guide rails, and brick support pier. */
function Ramp({ angle }: { readonly angle: RampAngle }) {
  const epoxyTex = useMemo(createEpoxyTexture, []);
  useEffect(() => () => epoxyTex?.dispose(), [epoxyTex]);

  const frame = rampFrame(angle);
  const middle = {
    x: 0,
    y: 0.08 + (BOARD.length / 2) * Math.sin(frame.tilt) - BOARD.thickness / 2,
  };
  const pierHeight = Math.max(0.08, frame.top.y - BOARD.thickness * 0.4);
  return (
    <group>
      {/* Full speckled epoxy laboratory bench with stainless backsplash and cabinet base */}
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <boxGeometry args={[6.2, 0.08, 1.8]} />
        <meshPhysicalMaterial
          clearcoat={0.28}
          clearcoatRoughness={0.42}
          color={epoxyTex === null ? BENCH_COLORS.epoxy : getColor("WHITE")}
          map={epoxyTex}
          roughness={0.56}
        />
      </mesh>
      <mesh position={[0, -0.078, 0.895]}>
        <boxGeometry args={[6.2, 0.014, 0.022]} />
        <meshStandardMaterial color={BENCH_COLORS.epoxyDrip} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.04, -0.885]} receiveShadow>
        <boxGeometry args={[6.2, 0.08, 0.03]} />
        <MetalMaterial color={BENCH_COLORS.backsplashSteel} roughness={0.34} />
      </mesh>
      <mesh position={[0, -0.94, 0.02]}>
        <boxGeometry args={[6.12, 1.72, 1.72]} />
        <meshStandardMaterial color={BENCH_COLORS.cabinet} roughness={0.62} />
      </mesh>
      <mesh position={[0, -0.44, 0.885]}>
        <boxGeometry args={[6.0, 0.01, 0.008]} />
        <meshStandardMaterial
          color={BENCH_COLORS.cabinetSeam}
          roughness={0.8}
        />
      </mesh>
      {Arr.map([-1.5, 1.5] as const, (hx) => (
        <mesh key={hx} position={[hx, -0.26, 0.898]}>
          <boxGeometry args={[0.32, 0.024, 0.022]} />
          <MetalMaterial color={BENCH_COLORS.cabinetHandle} roughness={0.32} />
        </mesh>
      ))}
      {/* Hardwood timber inclined plane with recessed brass guide rails */}
      <group position={[middle.x, middle.y, 0]} rotation={[0, 0, -frame.tilt]}>
        <RoundedBox
          args={[BOARD.length, BOARD.thickness, BOARD.width]}
          castShadow
          radius={0.01}
          receiveShadow
          smoothness={2}
        >
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.oak}
            repeat={[8, 1]}
            surface="wood"
          />
        </RoundedBox>
        {/* Recessed dark walnut ball track channel */}
        <mesh
          position={[0, BOARD.thickness / 2 + 0.001, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[BOARD.length - 0.06, 0.052]} />
          <meshStandardMaterial
            color={ROAD_COLORS.gravelGroove}
            roughness={0.52}
          />
        </mesh>
        {/* Twin machined brass guide rails framing the groove */}
        {Arr.map([-0.032, 0.032] as const, (rz) => (
          <mesh
            castShadow
            key={rz}
            position={[0, BOARD.thickness / 2 + 0.008, rz]}
          >
            <boxGeometry args={[BOARD.length - 0.06, 0.014, 0.01]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
          </mesh>
        ))}
        {/* End stop bumper with rubber cushion */}
        <RoundedBox
          args={[0.04, 0.06, BOARD.width]}
          castShadow
          position={[BOARD.length / 2 - 0.02, BOARD.thickness / 2 + 0.02, 0]}
          radius={0.006}
          smoothness={2}
        >
          <SurfaceMaterial color={CAR_COLORS.tyre} surface="rubber" />
        </RoundedBox>
      </group>
      {/* Terracotta masonry support pier + brass levelling plate */}
      <RoundedBox
        args={[0.28, pierHeight, BOARD.width + 0.1]}
        castShadow
        position={[frame.top.x + 0.16, pierHeight / 2, 0]}
        radius={0.012}
        receiveShadow
        smoothness={2}
      >
        <SurfaceMaterial
          color={BENCH_COLORS.brick}
          repeat={[2, 2]}
          surface="concrete"
        />
      </RoundedBox>
      <mesh
        castShadow
        position={[frame.top.x + 0.16, pierHeight + 0.01, 0]}
        receiveShadow
      >
        <boxGeometry args={[0.3, 0.018, BOARD.width + 0.12]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.32} />
      </mesh>
    </group>
  );
}

/** One flared lathed brass hand-bell on a cast-iron gantry arch over the ramp, glowing on beat. */
function Bell({
  index,
  ref,
  place,
}: {
  readonly index: number;
  readonly place: { readonly x: number; readonly y: number };
  readonly ref: Ref<MeshStandardMaterial>;
}) {
  const bellTop = place.y + 0.16;
  return (
    <group position={[place.x, 0, -BOARD.width / 2 - 0.07]}>
      {/* Weighted cast-iron base foot */}
      <mesh castShadow position={[0, 0.014, 0]} receiveShadow>
        <cylinderGeometry args={[0.048, 0.056, 0.028, 20]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.45} />
      </mesh>
      {/* Vertical iron stand rod */}
      <mesh castShadow position={[0, bellTop / 2 + 0.02, 0]}>
        <cylinderGeometry args={[0.009, 0.01, bellTop + 0.04, 12]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.38} />
      </mesh>
      {/* Brass overhang arm reaching over the ramp track */}
      <mesh
        castShadow
        position={[0, bellTop + 0.03, 0.095]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.007, 0.007, 0.19, 10]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
      </mesh>
      {/* Flared lathed brass bell dome */}
      <mesh castShadow position={[0, bellTop - 0.04, 0.17]}>
        <latheGeometry args={[BELL_PROFILE, 32]} />
        <meshStandardMaterial
          color={INSTRUMENT_COLORS.brass}
          emissive={PLOT_COLORS.amber}
          emissiveIntensity={0}
          metalness={0.95}
          ref={ref}
          roughness={0.22}
          side={DoubleSide}
        />
      </mesh>
      {/* Brass clapper ball inside bell */}
      <mesh position={[0, bellTop - 0.042, 0.17]}>
        <sphereGeometry args={[0.012, 12, 10]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.4} />
      </mesh>
      <ThreeLabel
        color={CAR_COLORS.tyre}
        fontSize={0.085}
        position={[0, bellTop + 0.14, 0.12]}
      >
        <span>{`${index + 1} s`}</span>
      </ThreeLabel>
    </group>
  );
}

/** The ball rolling down from rest, the bells ringing as it reaches each one at a whole second. */
function RampScene({
  angle,
  onReset,
}: {
  readonly angle: RampAngle;
  readonly onReset: () => void;
}) {
  const ball = useRef<Group>(null);
  const bells = useRef<(MeshStandardMaterial | null)[]>([]);
  const { advance, playing } = useTimeline(-0.5, BELLS + 0.4);
  const frame = useMemo(() => rampFrame(angle), [angle]);
  const places = useMemo(
    () =>
      Arr.map(bellPlaces(angle), (distance) => ({
        x: frame.top.x + distance * frame.down.x,
        y: frame.top.y + distance * frame.down.y,
      })),
    [angle, frame]
  );

  useVisualReset(onReset);

  useFrame((_, delta) => {
    const time = advance(delta);
    const distance = Math.min(rampDistance(angle, time), BOARD.length - 0.12);
    ball.current?.position.set(
      frame.top.x + distance * frame.down.x - Math.sin(frame.tilt) * BALL,
      frame.top.y + distance * frame.down.y + Math.cos(frame.tilt) * BALL,
      0
    );
    ball.current?.rotation.set(0, 0, -distance / BALL);
    Arr.forEach(bells.current, (bell, index) => {
      const since = time - (index + 1);
      const glow = since >= 0 && since < RING ? 3.2 * (1 - since / RING) : 0;
      if (bell) {
        bell.emissiveIntensity = glow;
      }
    });
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <Ramp angle={angle} />
      {Arr.map(places, (place, index) => (
        <Bell
          index={index}
          key={place.x}
          place={place}
          ref={(material) => {
            bells.current[index] = material;
          }}
        />
      ))}
      <group
        position={[
          frame.top.x - Math.sin(frame.tilt) * BALL,
          frame.top.y + Math.cos(frame.tilt) * BALL,
          0,
        ]}
        ref={ball}
      >
        <mesh castShadow>
          <sphereGeometry args={[BALL, 36, 24]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.14} />
        </mesh>
      </group>
    </group>
  );
}

interface GalileoInclineBellsLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    acceleration: ReactNode;
    chooseAngle: string;
    firstSecond: ReactNode;
    gaps: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

/**
 * Galileo's inclined plane: a steel ball rolls from rest down a gentle
 * wooden ramp past four bells set where it will be after 1, 2, 3 and 4 s.
 * The bells ring at an even beat although their gaps grow as 1 : 3 : 5 : 7,
 * because the distance grows with the square of the time.
 */
/**
 * Looks down the bench at the whole ramp. A narrow frame is as wide as it is
 * tall, so its camera stands further back to keep both ends of the board in.
 */
function RampCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [-0.7, 5.2, 6.1] : [-0.5, 3.2, 3.9]}
      cameraTarget={[0, 0.15, -0.1]}
      fov={40}
      maxDistance={10.5}
      minDistance={1.2}
    />
  );
}

export function GalileoInclineBellsLab({
  description,
  labels,
  title,
}: GalileoInclineBellsLabProps) {
  const [angle, setAngle] = useState<RampAngle>(3);
  const quantity = useQuantity();
  const isAngle = Schema.is(RampAngleSchema);
  const gaps = bellGaps(angle);
  const first = gaps[0] ?? 0;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseAngle}
          gridColumns="3"
          onValueChange={(value) => {
            const next = Number(value);
            if (isAngle(next)) {
              setAngle(next);
            }
          }}
          type="single"
          value={String(angle)}
          variant="outline"
        >
          {Arr.map(RampAngleSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={String(option)}>
              <InlineMath math={`\\theta=${option}^\\circ`} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={-0.08} reach={2.8} setting="lab">
          <Suspense fallback={null}>
            <RampCamera />
            <RampScene angle={angle} onReset={() => setAngle(3)} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.acceleration}
            value={
              <InlineMath
                math={quantity(rampAcceleration(angle), "\\text{ m/s}^2", 3)}
              />
            }
          />
          <VisualFactTabular
            label={labels.firstSecond}
            value={
              <InlineMath math={quantity(first * 100, "\\text{ cm}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.gaps}
            value={
              <InlineMath
                math={Arr.join(
                  Arr.map(gaps, (gap) => quantity(gap / first, "", 0)),
                  " : "
                )}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
