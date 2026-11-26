import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  COL_STEP,
  DEPTH_Z,
  HOST_RADIUS,
  HydraulicShearRam,
  LATTICE_X,
  RIG_Z,
  ROW_Y,
  ShearTestAnvil,
  SLIP_Y,
  SlipPlaneSheet,
} from "@repo/design-system/components/contents/chemistry/alloy/apparatus";
import type { AlloyMetal } from "@repo/design-system/components/contents/chemistry/alloy/model";
import { evaluateAlloySlip } from "@repo/design-system/components/contents/chemistry/alloy/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";

const STEEL_INTERSTITIALS = [
  [-0.026, -0.013],
  [0.026, 0.013],
  [-0.078, 0.012],
  [0.078, -0.012],
] as const;

function AlloyCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 0.34, 1.15] : [0, 0.27, 0.85]}
      cameraTarget={[0.01, 0.145, 0.02]}
      fov={37}
      maxDistance={2.2}
      minDistance={0.38}
    />
  );
}

function hostMetalColor(metal: AlloyMetal): string {
  return Match.value(metal).pipe(
    Match.when("pureIron", () => PROCESS_COLORS.anodeZinc),
    Match.when("steel", () => PROCESS_COLORS.alloySteel),
    Match.when("bronze", () => INSTRUMENT_COLORS.copper),
    Match.when("brass", () => PROCESS_COLORS.alloyBronze),
    Match.exhaustive
  );
}

function isSubstitutionalSite(
  metal: AlloyMetal,
  row: number,
  col: number,
  depthIdx: number
): boolean {
  if (row !== 1) {
    return false;
  }
  if (metal === "bronze") {
    return (col === 2 && depthIdx === 1) || (col === 1 && depthIdx === 0);
  }
  if (metal === "brass") {
    return (col === 2 && depthIdx === 1) || (col === 3 && depthIdx === 0);
  }
  return false;
}

function distortionOffset(
  metal: AlloyMetal,
  row: number,
  col: number
): readonly [number, number] {
  if (metal === "pureIron") {
    return [0, 0];
  }
  if (metal === "steel") {
    const bulgeY =
      row === 2 && (col === 1 || col === 2 || col === 3) ? 0.0035 : 0;
    return [0, bulgeY];
  }
  let dx = 0;
  if (col === 1) {
    dx = -0.005;
  } else if (col === 3) {
    dx = 0.005;
  }
  let dy = 0;
  if (row === 2 && col >= 1 && col <= 3) {
    dy = 0.0055;
  } else if (row === 0 && col === 2) {
    dy = -0.003;
  }
  return [dx, dy];
}

const RAM_REST_X = LATTICE_X - 2 * COL_STEP - HOST_RADIUS - 0.012;
const ARROW_REST_X = -0.215;

export function AlloySlipPlaneScene({
  metal,
  parts,
  shearForce,
}: {
  readonly metal: AlloyMetal;
  readonly parts: Readonly<
    Record<"foreignAtom" | "hostAtom" | "shearArrow" | "slipPlane", string>
  >;
  readonly shearForce: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const labelInk = useLabelInk();

  const topLayerRef = useRef<Group>(null);
  const ramRef = useRef<Group>(null);
  const arrowRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const slip = evaluateAlloySlip(metal, shearForce);
  const hostColor = hostMetalColor(metal);
  const baseShiftM = slip.layerShift * 0.145;

  const lowerAtoms = useMemo(
    () =>
      Arr.makeBy(20, (idx) => {
        const depthIdx = idx % 2;
        const planeIdx = Math.floor(idx / 2);
        const col = planeIdx % 5;
        const row = Math.floor(planeIdx / 5);
        return {
          col,
          depthIdx,
          id: `lo-${row}-${col}-${depthIdx}`,
          row,
        };
      }),
    []
  );

  const topAtoms = useMemo(
    () =>
      Arr.makeBy(10, (idx) => {
        const depthIdx = idx % 2;
        const col = Math.floor(idx / 2);
        return {
          col,
          depthIdx,
          id: `hi-${col}-${depthIdx}`,
        };
      }),
    []
  );

  useEffect(() => {
    if (topLayerRef.current !== null) {
      topLayerRef.current.position.x = baseShiftM;
    }
    if (ramRef.current !== null) {
      ramRef.current.position.x = RAM_REST_X + baseShiftM;
    }
    if (arrowRef.current !== null) {
      arrowRef.current.position.x = ARROW_REST_X + (shearForce / 100) * 0.014;
    }
  }, [baseShiftM, shearForce]);

  useVisualStop(() => {
    phaseRef.current = 0;
    if (topLayerRef.current !== null) {
      topLayerRef.current.position.x = baseShiftM;
    }
    if (ramRef.current !== null) {
      ramRef.current.position.x = RAM_REST_X + baseShiftM;
    }
    if (arrowRef.current !== null) {
      arrowRef.current.position.x = ARROW_REST_X + (shearForce / 100) * 0.014;
      arrowRef.current.scale.setScalar(1);
    }
    invalidate();
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 2.2;
    const p = phaseRef.current;
    const wave = 0.5 - 0.5 * Math.cos(p);
    const dynamicAmp = metal === "pureIron" ? 0.036 : 0.007;
    const currentShift =
      baseShiftM * (0.55 + 0.45 * Math.cos(p)) + wave * dynamicAmp;

    if (topLayerRef.current !== null) {
      topLayerRef.current.position.x = currentShift;
    }
    if (ramRef.current !== null) {
      ramRef.current.position.x = RAM_REST_X + currentShift;
    }
    if (arrowRef.current !== null) {
      arrowRef.current.position.x =
        ARROW_REST_X + (shearForce / 100) * 0.014 + wave * 0.018;
      arrowRef.current.scale.set(
        1 + wave * 0.08,
        1 + wave * 0.04,
        1 + wave * 0.04
      );
    }
  });

  const foreignAtomRadius = Match.value(metal).pipe(
    Match.when("bronze", () => 0.0295),
    Match.when("brass", () => 0.0282),
    Match.orElse(() => HOST_RADIUS)
  );

  return (
    <group>
      <SimulationTicker running={playing} />
      <AlloyCamera />
      <ShearTestAnvil />
      <HydraulicShearRam
        arrowRef={arrowRef}
        ramRef={ramRef}
        shearForce={shearForce}
      />
      <SlipPlaneSheet distorted={slip.hasForeignAtoms} />

      {/* Lower two clamped atomic layers (rows 0 and 1, 2 depth planes) */}
      <group position={[0, 0, RIG_Z]}>
        {Arr.map(lowerAtoms, (atom) => {
          const isSub = isSubstitutionalSite(
            metal,
            atom.row,
            atom.col,
            atom.depthIdx
          );
          const [dx, dy] = isSub
            ? ([0, 0.003] as const)
            : distortionOffset(metal, atom.row, atom.col);
          const x = LATTICE_X + (atom.col - 2) * COL_STEP + dx;
          const y = (ROW_Y[atom.row] ?? ROW_Y[0]) + dy;
          const z = DEPTH_Z[atom.depthIdx] ?? 0;

          return (
            <mesh castShadow key={atom.id} position={[x, y, z]}>
              <sphereGeometry
                args={[isSub ? foreignAtomRadius : HOST_RADIUS, 24, 20]}
              />
              <MetalMaterial
                color={isSub ? PROCESS_COLORS.electronGold : hostColor}
                roughness={isSub ? 0.2 : 0.25}
              />
            </mesh>
          );
        })}

        {/* Interstitial carbon atoms wedged in octahedral gaps for steel */}
        {metal === "steel"
          ? Arr.map(STEEL_INTERSTITIALS, ([dx, dz]) => (
              <mesh
                castShadow
                key={`${dx}-${dz}`}
                position={[LATTICE_X + dx, SLIP_Y - 0.002, dz]}
              >
                <sphereGeometry args={[0.0112, 18, 16]} />
                <MetalMaterial
                  color={PROCESS_COLORS.electronGold}
                  roughness={0.28}
                />
              </mesh>
            ))
          : null}
      </group>

      {/* Top atomic layer (row 2) sliding along slip plane under hydraulic ram */}
      <group position={[baseShiftM, 0, RIG_Z]} ref={topLayerRef}>
        {Arr.map(topAtoms, (atom) => {
          const [dx, dy] = distortionOffset(metal, 2, atom.col);
          const x = LATTICE_X + (atom.col - 2) * COL_STEP + dx;
          const y = ROW_Y[2] + dy;
          const z = DEPTH_Z[atom.depthIdx] ?? 0;

          return (
            <mesh castShadow key={atom.id} position={[x, y, z]}>
              <sphereGeometry args={[HOST_RADIUS, 24, 20]} />
              <MetalMaterial color={hostColor} roughness={0.24} />
            </mesh>
          );
        })}
      </group>

      {/* Adaptive labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.175, 0.305, RIG_Z]}
      >
        <span>{parts.shearArrow}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.285, 0.162, RIG_Z]}
      >
        <span>{parts.slipPlane}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.07, 0.036, RIG_Z + 0.125]}
      >
        <span>{parts.hostAtom}</span>
      </ThreeLabel>
      {slip.hasForeignAtoms ? (
        <ThreeLabel
          color={labelInk}
          fontSize="compact"
          position={[0.105, 0.258, RIG_Z + 0.045]}
        >
          <span>{parts.foreignAtom}</span>
        </ThreeLabel>
      ) : null}
    </group>
  );
}
