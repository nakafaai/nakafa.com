import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { JetAngle } from "@repo/design-system/components/contents/physics/kinematics/fountain/jet";
import {
  JET_GRAVITY,
  JetAngleSchema,
  jetDrop,
  jetShape,
} from "@repo/design-system/components/contents/physics/kinematics/fountain/jet";
import {
  Peg,
  SwivelJet,
} from "@repo/design-system/components/contents/physics/kinematics/fountain/swivel";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { chanceAt } from "@repo/design-system/components/three/field/noise";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  useVisualScene,
  useVisualStop,
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
import { HOSE_COLORS } from "@repo/design-system/lib/material/hose";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { InstancedMesh } from "three";
import { Matrix4, Quaternion, Vector3 } from "three";

/** How many drops are in the air at once. */
const DROPS = 420;

/** How many drops the stream throws up where it lands. */
const SPLASHES = 36;

/** Simulated seconds per wall second, so single drops can be followed. */
const PLAY_RATE = 0.5;

/** How far in front of the stream the row of metre pegs stands, in metres. */
const PEG_ROW = 0.5;

/** The axis a drop is turned about to lie along its path. */
const ACROSS = new Vector3(0, 0, 1);

interface HoseJetProjectileLabProps {
  /** The nozzle angle the card starts at, in degrees. */
  angle?: JetAngle;
  description: NonNullable<ReactNode>;
  labels: {
    chooseAngle: string;
    flight: ReactNode;
    range: ReactNode;
    top: ReactNode;
    viewLabel: string;
  };
  /** The speed the water leaves the nozzle at, in m/s. */
  speed: number;
  title: NonNullable<ReactNode>;
}

/**
 * A garden hose held at the ground and tilted to six angles. Every drop
 * follows the same parabola, so the stream is the path itself. The range
 * is greatest at 45 degrees, angles that add up to 90 degrees land at the
 * same spot, and the vertical jet climbs highest but lands at the nozzle.
 */
export function HoseJetProjectileLab({
  angle: initialAngle = 45,
  description,
  labels,
  speed,
  title,
}: HoseJetProjectileLabProps) {
  const [angle, setAngle] = useState<JetAngle>(initialAngle);
  const quantity = useQuantity();
  const shape = jetShape(speed, angle);
  const isAngle = Schema.is(JetAngleSchema);
  const farthest = (speed * speed) / JET_GRAVITY;
  const highest = farthest / 2;

  return (
    <VisualCard
      onReset={() => {
        setAngle(initialAngle);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseAngle}
          gridColumns="6"
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
          {Arr.map(JetAngleSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={String(option)}>
              <InlineMath math={`${option}^\\circ`} />
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
          frameloop="always"
          ground="grass"
          reach={farthest * 0.8}
          setting="field"
        >
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[
                farthest * 0.46,
                highest * 0.5,
                farthest * 1.02 + 1.6,
              ]}
              cameraTarget={[farthest * 0.46, highest * 0.42, 0]}
              fov={36}
              maxPolarAngle={Math.PI / 2 - 0.04}
            />
            <LawnScene angle={angle} speed={speed} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.range}
            value={<InlineMath math={quantity(shape.range, "\\text{ m}", 2)} />}
          />
          <VisualFactTabular
            label={labels.top}
            value={<InlineMath math={quantity(shape.top, "\\text{ m}", 2)} />}
          />
          <VisualFactTabular
            label={labels.flight}
            value={
              <InlineMath math={quantity(shape.flight, "\\text{ s}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The lawn with the swivel jet at the origin throwing its stream along +x:
 * every drop leaves one after another and follows the same parabola, so the
 * stream holds still while each drop in it moves. A row of pegs marks every
 * metre, a dashed arc marks the stream at 45 degrees, the farthest one, and
 * the stream's own range and top height are measured beside it.
 */
function LawnScene({
  angle,
  speed,
}: {
  readonly angle: JetAngle;
  readonly speed: number;
}) {
  const quantity = useQuantity();
  const playing = useVisualScene((card) => card.playing, false);
  const drops = useRef<InstancedMesh>(null);
  const splashes = useRef<InstancedMesh>(null);
  const clock = useRef(0);
  const { flight, range, top } = jetShape(speed, angle);
  const farthest = (speed * speed) / JET_GRAVITY;
  const tilt = (angle * Math.PI) / 180;
  const pen = useMemo(
    () => ({
      matrix: new Matrix4(),
      place: new Vector3(),
      size: new Vector3(),
      turn: new Quaternion(),
    }),
    []
  );
  const scatter = useMemo(
    () =>
      Float32Array.from(
        Arr.flatMap(Arr.range(0, DROPS - 1), (drop) => [
          chanceAt(drop, 7, 31) - 0.5,
          chanceAt(drop, 11, 37) - 0.5,
        ])
      ),
    []
  );
  const arc = useMemo(() => {
    const longest = jetShape(speed, 45).flight;
    return Arr.map(Arr.range(0, 40), (step) => {
      const at = jetDrop(speed, 45, (longest * step) / 40);
      return [at.x, at.y, 0] as const;
    });
  }, [speed]);
  const reach = useMemo(
    () =>
      [
        [0, 0.012, PEG_ROW - 0.18],
        [range, 0.012, PEG_ROW - 0.18],
      ] as const,
    [range]
  );
  const rise = useMemo(
    () =>
      [
        [range / 2, 0, 0],
        [range / 2, top, 0],
      ] as const,
    [range, top]
  );

  useVisualStop(() => {
    clock.current = 0;
  });

  useFrame((_, delta) => {
    if (playing) {
      clock.current += simulationStep(delta) * PLAY_RATE;
    }
    const stream = drops.current;
    const crown = splashes.current;
    if (stream === null || crown === null) {
      return;
    }
    const along = speed * Math.cos(tilt);
    const up = speed * Math.sin(tilt);
    for (let drop = 0; drop < DROPS; drop += 1) {
      const age = ((drop / DROPS) * flight + clock.current) % flight;
      const spread = 0.09 * age;
      pen.place.set(
        along * age + (scatter[drop * 2] ?? 0) * spread,
        up * age - 0.5 * JET_GRAVITY * age * age,
        (scatter[drop * 2 + 1] ?? 0) * spread
      );
      pen.turn.setFromAxisAngle(
        ACROSS,
        Math.atan2(up - JET_GRAVITY * age, along)
      );
      pen.size.set(2.8 - (1.4 * age) / flight, 1, 1);
      stream.setMatrixAt(
        drop,
        pen.matrix.compose(pen.place, pen.turn, pen.size)
      );
    }
    stream.instanceMatrix.needsUpdate = true;
    pen.turn.identity();
    for (let splash = 0; splash < SPLASHES; splash += 1) {
      const life = (clock.current * 2.6 + splash / SPLASHES) % 1;
      const around = splash * 2.399;
      const out = 0.04 + 0.34 * life * (0.5 + (splash % 5) / 6);
      const size = 0.9 - 0.6 * life;
      pen.place.set(
        range + out * Math.cos(around),
        0.02 + 0.5 * life * (1 - life),
        out * Math.sin(around)
      );
      pen.size.set(size, size, size);
      crown.setMatrixAt(
        splash,
        pen.matrix.compose(pen.place, pen.turn, pen.size)
      );
    }
    crown.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <SwivelJet tilt={tilt} />
      <instancedMesh
        args={[undefined, undefined, DROPS]}
        castShadow
        frustumCulled={false}
        ref={drops}
      >
        <sphereGeometry args={[0.017, 10, 8]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.05}
          color={HOSE_COLORS.water}
          envMapIntensity={1.6}
          opacity={0.86}
          roughness={0.06}
          transparent
        />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, SPLASHES]}
        frustumCulled={false}
        ref={splashes}
      >
        <sphereGeometry args={[0.014, 8, 6]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.05}
          color={HOSE_COLORS.water}
          envMapIntensity={1.6}
          opacity={0.8}
          roughness={0.06}
          transparent
        />
      </instancedMesh>
      <CameraBounds exclude>
        <mesh
          position={[range, 0.006, 0]}
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.44, 40]} />
          <meshStandardMaterial
            color={HOSE_COLORS.wet}
            depthWrite={false}
            opacity={0.5}
            roughness={0.12}
            transparent
          />
        </mesh>
      </CameraBounds>
      <Line
        color={getColor("WHITE")}
        dashed
        dashSize={0.12}
        gapSize={0.1}
        lineWidth={1.5}
        opacity={0.6}
        points={arc}
        transparent
      />
      {Arr.map(Arr.range(1, Math.ceil(farthest)), (metre) => (
        <group key={metre} position={[metre, 0, PEG_ROW]}>
          <Peg />
          <ThreeLabel
            color={getColor("SLATE", 800)}
            fontSize="compact"
            outlineColor={getColor("SLATE", 50)}
            outlineWidth={0.05}
            position={[0, 0.36, 0]}
          >
            <InlineMath math={quantity(metre, "\\text{ m}", 0)} />
          </ThreeLabel>
        </group>
      ))}
      <Line color={PLOT_COLORS.teal} lineWidth={3} points={reach} />
      <ThreeLabel
        color={PLOT_COLORS.teal}
        fontSize="compact"
        outlineColor={getColor("SLATE", 50)}
        outlineWidth={0.05}
        position={[range / 2, 0.02, PEG_ROW + 0.55]}
      >
        <InlineMath math={quantity(range, "\\text{ m}", 2)} />
      </ThreeLabel>
      <Line
        color={PLOT_COLORS.violet}
        dashed
        dashSize={0.08}
        gapSize={0.06}
        lineWidth={2}
        points={rise}
      />
      <ThreeLabel
        color={PLOT_COLORS.violet}
        fontSize="compact"
        outlineColor={getColor("SLATE", 50)}
        outlineWidth={0.05}
        position={[range / 2, top + 0.3, 0]}
      >
        <InlineMath math={quantity(top, "\\text{ m}", 2)} />
      </ThreeLabel>
    </>
  );
}
