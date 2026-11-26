import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { prepareAnatomicalScene } from "@repo/design-system/components/contents/biology/anatomy";
import {
  HRA_LIVER_ASSET,
  HRA_PANCREAS_ASSET,
} from "@repo/design-system/components/contents/biology/assets";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { GlucoseState } from "@repo/design-system/components/contents/biology/glucose/model";
import { evaluateGlucoseFeedback } from "@repo/design-system/components/contents/biology/glucose/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { HEART_COLORS } from "@repo/design-system/lib/material/heart";
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { Array as Arr, Match, Schema } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  CatmullRomCurve3,
  LatheGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

const PANCREAS_MATERIAL = {
  clearcoat: 0.42,
  clearcoatRoughness: 0.34,
  color: HOMEOSTASIS_COLORS.pancreasTissue,
  roughness: 0.48,
  sheen: 0.45,
} as const;

const LIVER_MATERIAL = {
  clearcoat: 0.62,
  clearcoatRoughness: 0.24,
  color: HOMEOSTASIS_COLORS.liverTissue,
  roughness: 0.36,
  sheen: 0.35,
  sheenColor: HEART_COLORS.sheen,
} as const;

const LIVER_RULES = [
  {
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    color: HOMEOSTASIS_COLORS.epidermis,
    match: "ligament",
    roughness: 0.55,
  },
] as const;

/** Organic glycogen rosette cluster offsets (replaces primitive octahedron). */
const GLYCOGEN_NODES: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 0, 0.056],
  [0.068, 0.032, 0.02, 0.044],
  [-0.064, 0.038, 0.025, 0.042],
  [0.048, -0.056, 0.03, 0.044],
  [-0.052, -0.048, 0.028, 0.04],
  [0.01, 0.072, 0.015, 0.038],
  [0.095, -0.015, -0.01, 0.032],
  [-0.092, 0.005, -0.01, 0.032],
];

/** Biconcave erythrocyte disc turned from a 2D anatomical profile. */
function buildErythrocyteGeometry() {
  const pts = [
    new Vector2(0.001, -0.008),
    new Vector2(0.016, -0.009),
    new Vector2(0.032, -0.018),
    new Vector2(0.042, -0.01),
    new Vector2(0.044, 0),
    new Vector2(0.042, 0.01),
    new Vector2(0.032, 0.018),
    new Vector2(0.016, 0.009),
    new Vector2(0.001, 0.008),
  ];
  return new LatheGeometry(pts, 20);
}

function buildPortalCurve() {
  return new CatmullRomCurve3([
    new Vector3(-0.74, 0.52, 0.02),
    new Vector3(-0.34, 0.46, 0.08),
    new Vector3(0.06, 0.56, 0.04),
    new Vector3(0.42, 0.62, -0.02),
    new Vector3(0.76, 0.56, 0.02),
  ]);
}

function GlucoseCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.82, 4.45] : [0, 1.38, 3.55]}
      cameraTarget={[0, 0.58, 0]}
      fov={38}
      maxDistance={7.2}
      minDistance={1.6}
    />
  );
}

function PancreasSpecimen() {
  const { scene } = useGLTF(HRA_PANCREAS_ASSET.path);
  const specimen = useMemo(
    () =>
      prepareAnatomicalScene(scene, {
        fallback: PANCREAS_MATERIAL,
        targetExtent: 0.86,
      }),
    [scene]
  );
  return (
    <group position={[-1.02, 0.54, 0]} rotation={[0.14, 0.25, -0.08]}>
      <primitive object={specimen} />
    </group>
  );
}

function LiverSpecimen() {
  const { scene } = useGLTF(HRA_LIVER_ASSET.path);
  const specimen = useMemo(
    () =>
      prepareAnatomicalScene(scene, {
        fallback: LIVER_MATERIAL,
        rules: LIVER_RULES,
        targetExtent: 0.96,
      }),
    [scene]
  );
  return (
    <group position={[1.04, 0.58, -0.02]} rotation={[0.1, -0.32, 0.04]}>
      <primitive object={specimen} />
    </group>
  );
}

export function GlucoseFeedbackScene({
  glucoseLevel,
  parts,
  state,
}: {
  readonly glucoseLevel: number;
  readonly parts: Readonly<
    Record<
      | "alphaCell"
      | "betaCell"
      | "bloodVessel"
      | "glycogen"
      | "liver"
      | "pancreas",
      string
    >
  >;
  readonly state: GlucoseState;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const flowRef = useRef<Group>(null);
  const rbcRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluateGlucoseFeedback(state, glucoseLevel);

  const portalCurve = useMemo(buildPortalCurve, []);
  const vesselGeo = useMemo(
    () => new TubeGeometry(portalCurve, 56, 0.135, 24, false),
    [portalCurve]
  );
  const rbcGeo = useMemo(buildErythrocyteGeometry, []);

  useEffect(
    () => () => {
      vesselGeo.dispose();
      rbcGeo.dispose();
    },
    [rbcGeo, vesselGeo]
  );

  const dots = useMemo(
    () =>
      Arr.makeBy(
        Math.min(20, Math.max(3, reading.vesselParticles)),
        (index) => ({
          id: `gl-${index}`,
          offset: index / Math.max(3, reading.vesselParticles),
          radialAngle: index * 2.1,
        })
      ),
    [reading.vesselParticles]
  );

  const rbcs = useMemo(
    () =>
      Arr.makeBy(6, (index) => ({
        id: `rbc-${index}`,
        offset: index / 6,
      })),
    []
  );

  const hormoneColor = Match.value(reading.hormone).pipe(
    Match.when("insulin", () => HOMEOSTASIS_COLORS.betaCell),
    Match.when("glucagon", () => HOMEOSTASIS_COLORS.alphaCell),
    Match.orElse(() => HOMEOSTASIS_COLORS.receptor)
  );

  useFrame((_, delta) => {
    const step = playing ? simulationStep(delta) * 0.24 : 0;
    phaseRef.current = (phaseRef.current + step) % 1;
    updateGlucoseFlow(flowRef.current, portalCurve, dots, phaseRef.current);
    updateErythrocyteFlow(rbcRef.current, portalCurve, rbcs, phaseRef.current);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <GlucoseCamera />

      {/* Left: Real NIH Human Reference Atlas Pancreas + Islet of Langerhans endocrine inset */}
      <PancreasSpecimen />
      <group position={[-0.96, 0.56, 0.26]}>
        <mesh>
          <sphereGeometry args={[0.145, 24, 20]} />
          <meshPhysicalMaterial
            clearcoat={0.7}
            color={HOMEOSTASIS_COLORS.epidermis}
            depthWrite={false}
            opacity={0.28}
            roughness={0.18}
            transparent
          />
        </mesh>
        {Arr.map(
          [
            [-0.055, 0.045, 0.04],
            [-0.025, 0.06, -0.02],
            [-0.06, -0.01, 0.02],
          ] as const,
          ([x, y, z]) => (
            <mesh key={`a-${x}-${y}-${z}`} position={[x, y, z]}>
              <sphereGeometry args={[0.032, 16, 14]} />
              <meshPhysicalMaterial
                clearcoat={0.6}
                color={HOMEOSTASIS_COLORS.alphaCell}
                emissive={
                  reading.hormone === "glucagon"
                    ? HOMEOSTASIS_COLORS.alphaCell
                    : HOMEOSTASIS_COLORS.labelInk
                }
                emissiveIntensity={reading.hormone === "glucagon" ? 0.55 : 0}
                roughness={0.28}
              />
            </mesh>
          )
        )}
        {Arr.map(
          [
            [0.045, -0.035, 0.04],
            [0.02, -0.055, -0.015],
            [0.06, 0.015, 0.02],
          ] as const,
          ([x, y, z]) => (
            <mesh key={`b-${x}-${y}-${z}`} position={[x, y, z]}>
              <sphereGeometry args={[0.034, 16, 14]} />
              <meshPhysicalMaterial
                clearcoat={0.6}
                color={HOMEOSTASIS_COLORS.betaCell}
                emissive={
                  reading.hormone === "insulin"
                    ? HOMEOSTASIS_COLORS.betaCell
                    : HOMEOSTASIS_COLORS.labelInk
                }
                emissiveIntensity={reading.hormone === "insulin" ? 0.55 : 0}
                roughness={0.28}
              />
            </mesh>
          )
        )}
      </group>

      {/* Center: Organic curved translucent hepatic portal vein */}
      <mesh geometry={vesselGeo}>
        <meshPhysicalMaterial
          clearcoat={0.85}
          clearcoatRoughness={0.14}
          color={HOMEOSTASIS_COLORS.vesselWall}
          depthWrite={false}
          ior={1.38}
          opacity={0.34}
          roughness={0.16}
          transparent
        />
      </mesh>

      {/* Flowing glucose molecules + active hormone markers */}
      <group ref={flowRef}>
        {Arr.map(dots, (dot, idx) => {
          const pt = portalCurve.getPointAt(dot.offset);
          const isHormone = idx % 4 === 0 && reading.hormone !== "deficient";
          return (
            <mesh key={dot.id} position={[pt.x, pt.y, pt.z]}>
              <sphereGeometry args={[isHormone ? 0.028 : 0.036, 16, 14]} />
              <meshPhysicalMaterial
                clearcoat={0.5}
                color={
                  isHormone ? hormoneColor : HOMEOSTASIS_COLORS.glucoseMolecule
                }
                roughness={0.25}
              />
            </mesh>
          );
        })}
      </group>

      {/* Flowing biconcave erythrocytes */}
      <group ref={rbcRef}>
        {Arr.map(rbcs, (cell) => {
          const pt = portalCurve.getPointAt(cell.offset);
          return (
            <mesh
              geometry={rbcGeo}
              key={cell.id}
              position={[pt.x, pt.y - 0.025, pt.z + 0.03]}
            >
              <meshPhysicalMaterial
                clearcoat={0.65}
                color={HOMEOSTASIS_COLORS.redBloodCell}
                roughness={0.28}
              />
            </mesh>
          );
        })}
      </group>

      {/* Right: Real NIH Human Reference Atlas Liver + organic glycogen rosette */}
      <LiverSpecimen />
      <group
        position={[0.98, 0.58, 0.34]}
        scale={[
          reading.glycogenScale,
          reading.glycogenScale,
          reading.glycogenScale,
        ]}
      >
        {Arr.map(GLYCOGEN_NODES, ([x, y, z, r]) => (
          <mesh castShadow key={`gly-${x}-${y}-${z}`} position={[x, y, z]}>
            <sphereGeometry args={[r, 18, 16]} />
            <meshPhysicalMaterial
              clearcoat={0.48}
              color={HOMEOSTASIS_COLORS.glycogenCluster}
              roughness={0.32}
            />
          </mesh>
        ))}
      </group>

      {/* Crisp well-framed labels (never clipped on edges) */}
      <ThreeLabel color={ink} fontSize="compact" position={[-0.95, 1.06, 0]}>
        <span>{parts.pancreas}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.95, 0.14, 0.25]}>
        <span>
          {parts.alphaCell} / {parts.betaCell}
        </span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0, 0.86, 0.1]}>
        <span>{parts.bloodVessel}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.98, 1.08, 0]}>
        <span>{parts.liver}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.98, 0.14, 0.28]}>
        <span>{parts.glycogen}</span>
      </ThreeLabel>
    </group>
  );
}

const GlucoseDotSchema = Schema.Struct({
  offset: Schema.Finite,
  radialAngle: Schema.Finite,
});
type GlucoseDot = typeof GlucoseDotSchema.Type;

const ErythrocyteCellSchema = Schema.Struct({
  offset: Schema.Finite,
});
type ErythrocyteCell = typeof ErythrocyteCellSchema.Type;

function updateGlucoseFlow(
  group: Group | null,
  curve: CatmullRomCurve3,
  dots: readonly GlucoseDot[],
  phase: number
) {
  if (group === null) {
    return;
  }
  for (let i = 0; i < group.children.length; i += 1) {
    const child = group.children[i];
    const dot = dots[i];
    if (child !== undefined && dot !== undefined) {
      const u = (phase + dot.offset) % 1;
      const pt = curve.getPointAt(u);
      child.position.set(
        pt.x,
        pt.y + Math.sin(dot.radialAngle + u * 6) * 0.045,
        pt.z + Math.cos(dot.radialAngle + u * 6) * 0.045
      );
    }
  }
}

function updateErythrocyteFlow(
  group: Group | null,
  curve: CatmullRomCurve3,
  cells: readonly ErythrocyteCell[],
  phase: number
) {
  if (group === null) {
    return;
  }
  for (let i = 0; i < group.children.length; i += 1) {
    const child = group.children[i];
    const cell = cells[i];
    if (child !== undefined && cell !== undefined) {
      const u = (phase * 0.7 + cell.offset) % 1;
      const pt = curve.getPointAt(u);
      child.position.set(pt.x, pt.y - 0.025, pt.z + 0.03);
      child.rotation.set(u * 4, u * 6, 0.4);
    }
  }
}

useGLTF.preload(HRA_PANCREAS_ASSET.path);
useGLTF.preload(HRA_LIVER_ASSET.path);
