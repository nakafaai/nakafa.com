import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  ColumnLiquid,
  LabBench,
} from "@repo/design-system/components/contents/chemistry/bench";
import type { SurfacePreset } from "@repo/design-system/components/contents/chemistry/collision/model";
import { evaluateCollision } from "@repo/design-system/components/contents/chemistry/collision/model";
import {
  GraduatedBeaker,
  Hotplate,
} from "@repo/design-system/components/contents/chemistry/collision/parts";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { KINETICS_COLORS } from "@repo/design-system/lib/material/kinetics";
import { Array as Arr, Match, Schema } from "effect";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";

const BEAKER_X = 0;
const BEAKER_Z = 0.02;
const BEAKER_BASE_Y = 0.072;
const LIQUID_LEVEL = 0.096;

const Vec3Tuple = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);

const MarblePieceSchema = Schema.Struct({
  id: Schema.String,
  radius: Schema.Finite,
  rot: Vec3Tuple,
  scale: Vec3Tuple,
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});

type MarblePiece = typeof MarblePieceSchema.Type;

function buildMarblePieces(surface: SurfacePreset): readonly MarblePiece[] {
  return Match.value(surface).pipe(
    Match.when("lump", () => [
      {
        id: "lump-0",
        radius: 0.019,
        rot: [0.35, 0.7, 0.2] as const,
        scale: [1.18, 0.86, 0.96] as const,
        x: 0.008,
        y: 0.02,
        z: 0.006,
      },
    ]),
    Match.when("granules", () =>
      Arr.makeBy(8, (index) => {
        const angle = (index / 8) * Math.PI * 2 + 0.25;
        const ring = index % 2 === 0 ? 0.023 : 0.015;
        return {
          id: `granule-${index}`,
          radius: 0.0074 + (index % 3) * 0.001,
          rot: [index * 0.7, index * 1.1, index * 0.4] as const,
          scale: [1.15, 0.78, 0.95] as const,
          x: Math.cos(angle) * ring,
          y: 0.0095 + (index % 2) * 0.002,
          z: Math.sin(angle) * ring,
        };
      })
    ),
    Match.when("powder", () =>
      Arr.makeBy(24, (index) => {
        const angle = index * 2.399_96;
        const ring = 0.007 + Math.sqrt((index + 0.5) / 24) * 0.032;
        return {
          id: `powder-${index}`,
          radius: 0.0031 + (index % 3) * 0.0005,
          rot: [index * 0.9, index * 1.4, index * 0.6] as const,
          scale: [1.1, 0.85, 1.05] as const,
          x: Math.cos(angle) * ring,
          y: 0.006 + (index % 4) * 0.0016,
          z: Math.sin(angle) * ring,
        };
      })
    ),
    Match.exhaustive
  );
}

const ReactantParticleSchema = Schema.Struct({
  angle: Schema.Finite,
  id: Schema.String,
  r: Schema.Finite,
  speed: Schema.Finite,
  yBase: Schema.Finite,
});

type ReactantParticle = typeof ReactantParticleSchema.Type;

const ProductBubbleSchema = Schema.Struct({
  angle: Schema.Finite,
  id: Schema.String,
  offset: Schema.Finite,
  r: Schema.Finite,
  size: Schema.Finite,
});

type ProductBubble = typeof ProductBubbleSchema.Type;

function stepReactants(
  group: Group | null,
  items: readonly ReactantParticle[],
  t: number
) {
  if (group === null) {
    return;
  }
  for (let i = 0; i < group.children.length; i += 1) {
    const child = group.children[i];
    const item = items[i];
    if (child !== undefined && item !== undefined) {
      const a = t * item.speed + item.angle;
      const y = Math.min(
        LIQUID_LEVEL - 0.008,
        Math.max(0.016, item.yBase + Math.sin(a * 1.35) * 0.018)
      );
      child.position.set(Math.cos(a) * item.r, y, Math.sin(a) * item.r);
    }
  }
}

function stepBubbles(
  group: Group | null,
  items: readonly ProductBubble[],
  t: number,
  rateScale: number
) {
  if (group === null) {
    return;
  }
  for (let i = 0; i < group.children.length; i += 1) {
    const child = group.children[i];
    const bubble = items[i];
    if (child !== undefined && bubble !== undefined) {
      const progress = (t * 0.24 * rateScale + bubble.offset) % 1;
      const wobble = Math.sin(t * 3 + bubble.angle) * 0.0025;
      child.position.set(
        Math.cos(bubble.angle) * bubble.r + wobble,
        0.014 + progress * (LIQUID_LEVEL - 0.018),
        Math.sin(bubble.angle) * bubble.r - wobble
      );
    }
  }
}

function CollisionCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.02, 0.36, 0.8] : [0.02, 0.27, 0.62]}
      cameraTarget={[0, 0.118, 0.02]}
      fov={38}
      maxDistance={1.65}
      minDistance={0.32}
    />
  );
}

export function CollisionVesselScene({
  concentrationM,
  parts,
  surface,
  temperatureK,
}: {
  readonly concentrationM: number;
  readonly parts: Readonly<Record<"products" | "reactants" | "vessel", string>>;
  readonly surface: SurfacePreset;
  readonly temperatureK: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const labelInk = useLabelInk();
  const reactantGroupRef = useRef<Group>(null);
  const bubbleGroupRef = useRef<Group>(null);
  const stirBarRef = useRef<Mesh>(null);
  const phaseRef = useRef(0);

  const heatNorm = Math.min(1, Math.max(0, (temperatureK - 270) / 150));
  const reading = evaluateCollision(temperatureK, concentrationM, surface);

  const solidPieces = useMemo(() => buildMarblePieces(surface), [surface]);

  const reactantCount = Math.min(
    26,
    Math.max(8, Math.round(6 + concentrationM * 10))
  );
  const reactants = useMemo(
    () =>
      Arr.makeBy(reactantCount, (index) => ({
        angle: index * 2.13,
        id: `reactant-${index}`,
        r: 0.011 + (index % 4) * 0.0075,
        speed: 0.8 + (index % 5) * 0.18,
        yBase: 0.022 + ((index * 0.019) % 0.062),
      })),
    [reactantCount]
  );

  const bubbleCount = Math.min(
    24,
    Math.max(4, Math.round(3 + reading.effectiveRate * 0.16))
  );
  const bubbles = useMemo(
    () =>
      Arr.makeBy(bubbleCount, (index) => ({
        angle: index * 2.39,
        id: `bubble-${index}`,
        offset: (index * 0.173) % 1,
        r: 0.006 + ((index * 0.009) % 0.028),
        size: 0.0022 + (index % 3) * 0.0007,
      })),
    [bubbleCount]
  );

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    const step = simulationStep(delta);
    const thermalSpeed = Math.sqrt(Math.max(250, temperatureK) / 300);
    phaseRef.current += step * thermalSpeed * 2.6;
    const t = phaseRef.current;

    if (stirBarRef.current !== null) {
      stirBarRef.current.rotation.y += step * (5.5 + heatNorm * 4.5);
    }
    stepReactants(reactantGroupRef.current, reactants, t);
    stepBubbles(
      bubbleGroupRef.current,
      bubbles,
      t,
      0.45 + Math.min(2.2, reading.effectiveRate / 45)
    );
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <CollisionCamera />
      <LabBench width={2.6} />

      {/* Left/Center: Magnetic-stirrer hotplate + 250 mL graduated beaker */}
      <group position={[BEAKER_X, 0, BEAKER_Z + 0.02]}>
        <Hotplate heatNorm={heatNorm} playing={playing} />
        <group position={[0, BEAKER_BASE_Y, -0.02]}>
          {/* PTFE magnetic stir bar */}
          <mesh
            castShadow
            position={[0, 0.0075, 0]}
            ref={stirBarRef}
            rotation={[0, 0.4, Math.PI / 2]}
          >
            <capsuleGeometry args={[0.0038, 0.018, 8, 16]} />
            <meshPhysicalMaterial
              clearcoat={0.35}
              color={BENCH_COLORS.ptfe}
              roughness={0.38}
            />
          </mesh>

          {/* Faceted mineral / marble solid reactant chunks */}
          {Arr.map(solidPieces, (piece) => (
            <mesh
              castShadow
              key={piece.id}
              position={[piece.x, piece.y, piece.z]}
              rotation={piece.rot}
              scale={piece.scale}
            >
              <dodecahedronGeometry args={[piece.radius, 0]} />
              <meshStandardMaterial
                color={KINETICS_COLORS.solidBlock}
                roughness={surface === "powder" ? 0.48 : 0.72}
              />
            </mesh>
          ))}

          {/* Colliding reactant spheres */}
          <group ref={reactantGroupRef}>
            {Arr.map(reactants, (item) => (
              <mesh
                key={item.id}
                position={[
                  Math.cos(item.angle) * item.r,
                  item.yBase,
                  Math.sin(item.angle) * item.r,
                ]}
              >
                <sphereGeometry args={[0.004, 12, 10]} />
                <meshPhysicalMaterial
                  clearcoat={0.6}
                  color={KINETICS_COLORS.reactant}
                  roughness={0.26}
                />
              </mesh>
            ))}
          </group>

          {/* Rising effervescent cyan product gas bubbles */}
          <group ref={bubbleGroupRef}>
            {Arr.map(bubbles, (bubble) => (
              <mesh
                key={bubble.id}
                position={[
                  Math.cos(bubble.angle) * bubble.r,
                  0.016 + bubble.offset * (LIQUID_LEVEL - 0.02),
                  Math.sin(bubble.angle) * bubble.r,
                ]}
                renderOrder={1}
              >
                <sphereGeometry args={[bubble.size, 10, 10]} />
                <meshPhysicalMaterial
                  clearcoat={1}
                  color={KINETICS_COLORS.product}
                  depthWrite={false}
                  opacity={0.78}
                  roughness={0.08}
                  transparent
                />
              </mesh>
            ))}
          </group>

          {/* Aqueous acid solution with concave meniscus */}
          <ColumnLiquid
            bottom={0.004}
            color={BENCH_COLORS.glass}
            level={LIQUID_LEVEL}
            opacity={0.34}
            radius={0.0448}
          />

          {/* Turned graduated borosilicate beaker */}
          <GraduatedBeaker />
        </group>
      </group>

      {/* Crisp adaptive-ink labels with zero overlap */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[BEAKER_X, 0.228, BEAKER_Z]}
      >
        <span>{parts.vessel}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={labelInk}
        fontSize="compact"
        position={[BEAKER_X + 0.066, 0.118, BEAKER_Z + 0.03]}
      >
        <span>{parts.reactants}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={labelInk}
        fontSize="compact"
        position={[BEAKER_X + 0.066, 0.166, BEAKER_Z + 0.03]}
      >
        <span>{parts.products}</span>
      </ThreeLabel>
    </group>
  );
}
