import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  ColumnLiquid,
  LabBench,
} from "@repo/design-system/components/contents/chemistry/bench";
import {
  CurvedPhStrip,
  DroppingPipette,
  GraduatedBeaker,
  IndicatorDroplet,
  PhReferenceCard,
  SpottingTile,
} from "@repo/design-system/components/contents/chemistry/indicator/geometry";
import type {
  IndicatorKind,
  PhSample,
} from "@repo/design-system/components/contents/chemistry/indicator/model";
import { evaluatePhIndicator } from "@repo/design-system/components/contents/chemistry/indicator/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { Array as Arr, Match } from "effect";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";

const BEAKER_X = -0.04;
const BENCH_Z = 0.04;
const TILE_TOP_Y = 0.012;
const LIQUID_LEVEL = 0.074;
const PIPETTE_Y = 0.172;
const STAND_X = -0.155;
const STAND_Z = -0.075;

function IndicatorCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.03, 0.29, 0.86] : [0.03, 0.25, 0.68]}
      cameraTarget={[0.01, 0.16, BENCH_Z]}
      fov={38}
      maxDistance={1.5}
      minDistance={0.28}
    />
  );
}

function toneHex(
  tone:
    | "blue"
    | "clear"
    | "green"
    | "orange"
    | "pink"
    | "purple"
    | "red"
    | "teal"
    | "yellow"
): string {
  return Match.value(tone).pipe(
    Match.when("red", () => PROCESS_COLORS.acidRed),
    Match.when("orange", () => PROCESS_COLORS.weakAcidOrange),
    Match.when("green", () => PROCESS_COLORS.neutralGreen),
    Match.when("teal", () => PROCESS_COLORS.weakBaseTeal),
    Match.when("blue", () => PROCESS_COLORS.alkaliBlue),
    Match.when("purple", () => PROCESS_COLORS.alkaliPurple),
    Match.when("pink", () => PROCESS_COLORS.phenolPink),
    Match.when("clear", () => REAGENT_COLORS.solution),
    Match.when("yellow", () => PROCESS_COLORS.electronGold),
    Match.exhaustive
  );
}

/** Retort stand and chrome bench clamp holding the glass dropping pipette over the beaker. */
function PipetteClampStand() {
  const clampY = 0.242;
  const dx = BEAKER_X - STAND_X;
  const dz = BENCH_Z - STAND_Z;
  const reach = Math.hypot(dx, dz);
  const yaw = Math.atan2(-dz, dx);

  return (
    <group>
      {/* Cast-iron stand base behind the ceramic tile */}
      <mesh
        castShadow
        position={[STAND_X + 0.01, 0.005, STAND_Z + 0.01]}
        receiveShadow
      >
        <boxGeometry args={[0.085, 0.01, 0.105]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.65} />
      </mesh>
      {/* Vertical chrome retort rod */}
      <mesh castShadow position={[STAND_X, 0.175, STAND_Z]}>
        <cylinderGeometry args={[0.0042, 0.0042, 0.34, 16]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
      </mesh>
      {/* Bosshead block on vertical rod */}
      <mesh castShadow position={[STAND_X, clampY, STAND_Z]}>
        <boxGeometry args={[0.018, 0.018, 0.018]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.5} />
      </mesh>
      {/* Horizontal chrome clamp arm reaching to pipette barrel */}
      <mesh
        castShadow
        position={[(STAND_X + BEAKER_X) / 2, clampY, (STAND_Z + BENCH_Z) / 2]}
        rotation={[0, yaw, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.0028, 0.0028, reach, 12]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
      </mesh>
      {/* Rubber-lined clamp collar gripping the pipette barrel */}
      <mesh
        position={[BEAKER_X, clampY, BENCH_Z]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.0076, 0.0022, 10, 24]} />
        <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.75} />
      </mesh>
    </group>
  );
}

/**
 * Bench-scale pH indicator station: porcelain spotting tile, 250 mL graduated
 * beaker with indicator solution and H+/OH- ions, curved paper pH strip,
 * clamped dropping pipette with animated droplets, and pH reference card.
 */
export function PhIndicatorScene({
  indicator,
  parts,
  sample,
}: {
  readonly indicator: IndicatorKind;
  readonly parts: Readonly<
    Record<"beaker" | "dropper" | "ionCloud" | "phStrip" | "solution", string>
  >;
  readonly sample: PhSample;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const labelInk = useLabelInk();
  const dropRef = useRef<Group>(null);
  const rippleRef = useRef<Mesh>(null);
  const ionsRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const reading = evaluatePhIndicator(sample, indicator);
  const liquidColor = toneHex(reading.colorTone);
  const protonCount = Math.max(
    1,
    Math.min(9, Math.round(reading.hPlusRatio * 10))
  );
  const buoyancyShift = (7 - reading.ph) * 0.0007;

  const ions = useMemo(
    () =>
      Arr.makeBy(10, (index) => {
        const angle = index * 2.399_96;
        const r = 0.01 + ((index * 7) % 5) * 0.0052;
        const baseY = 0.016 + ((index * 3) % 5) * 0.011;
        return {
          id: `ion-${index}`,
          isProton: index < protonCount,
          x: Math.cos(angle) * r,
          y: Math.min(0.064, Math.max(0.014, baseY + buoyancyShift)),
          z: Math.sin(angle) * r,
        };
      }),
    [buoyancyShift, protonCount]
  );

  useFrame((_, delta) => {
    if (!playing) {
      if (dropRef.current !== null) {
        dropRef.current.position.set(BEAKER_X, PIPETTE_Y - 0.012, BENCH_Z);
        dropRef.current.visible = true;
      }
      if (rippleRef.current !== null) {
        rippleRef.current.scale.setScalar(0.001);
        rippleRef.current.visible = false;
      }
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.15;
    const cycle = phaseRef.current % 1;
    if (dropRef.current !== null) {
      const fallShare = Math.min(1, cycle / 0.62);
      const dropY =
        PIPETTE_Y -
        0.008 -
        fallShare *
          fallShare *
          (PIPETTE_Y - 0.008 - (TILE_TOP_Y + LIQUID_LEVEL));
      dropRef.current.position.set(BEAKER_X, dropY, BENCH_Z);
      dropRef.current.visible = cycle < 0.63;
    }
    if (rippleRef.current !== null) {
      if (cycle >= 0.62) {
        const rippleShare = (cycle - 0.62) / 0.38;
        const s = 0.35 + rippleShare * 2.2;
        rippleRef.current.scale.set(s, s, 1);
        rippleRef.current.visible = true;
      } else {
        rippleRef.current.visible = false;
      }
    }
    if (ionsRef.current !== null) {
      ionsRef.current.rotation.y = Math.sin(phaseRef.current * 0.9) * 0.25;
      ionsRef.current.position.y = Math.sin(phaseRef.current * 2.1) * 0.0022;
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <IndicatorCamera />
      <LabBench width={2.4} />
      <PipetteClampStand />
      {/* Glazed white porcelain spotting tile on benchtop */}
      <group position={[0, 0, BENCH_Z]}>
        <SpottingTile />
      </group>
      {/* 250 mL graduated beaker standing on tile */}
      <group position={[BEAKER_X, TILE_TOP_Y, BENCH_Z]}>
        <GraduatedBeaker />
        <ColumnLiquid
          bottom={0.0035}
          color={liquidColor}
          level={LIQUID_LEVEL}
          opacity={reading.colorTone === "clear" ? 0.28 : 0.78}
          radius={0.0432}
        />
        {/* Meniscus ripple ring triggered by falling indicator droplets */}
        <mesh
          position={[0, LIQUID_LEVEL + 0.001, 0]}
          ref={rippleRef}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={0.001}
        >
          <ringGeometry args={[0.007, 0.011, 28]} />
          <meshBasicMaterial
            color={REAGENT_COLORS.solution}
            opacity={0.55}
            transparent
          />
        </mesh>
        {/* H+ and OH- ion spheres inside solution */}
        <group ref={ionsRef}>
          {Arr.map(ions, (ion) => (
            <group key={ion.id} position={[ion.x, ion.y, ion.z]}>
              <mesh castShadow>
                <sphereGeometry
                  args={[ion.isProton ? 0.0036 : 0.0046, 12, 10]}
                />
                <meshPhysicalMaterial
                  clearcoat={0.6}
                  color={
                    ion.isProton
                      ? PROCESS_COLORS.acidRed
                      : PROCESS_COLORS.alkaliBlue
                  }
                  roughness={0.25}
                />
              </mesh>
              {ion.isProton ? null : (
                <mesh position={[0.0042, 0.002, 0]}>
                  <sphereGeometry args={[0.0024, 10, 8]} />
                  <meshStandardMaterial
                    color={PROCESS_COLORS.saltBridgeWhite}
                    roughness={0.3}
                  />
                </mesh>
              )}
            </group>
          ))}
        </group>
        {/* Curved paper universal/litmus pH test strip */}
        <CurvedPhStrip
          stainColor={liquidColor}
          wetClear={reading.colorTone === "clear"}
        />
      </group>
      {/* Clamped borosilicate glass dropping pipette */}
      <group position={[BEAKER_X, PIPETTE_Y, BENCH_Z]}>
        <DroppingPipette reagentColor={liquidColor} />
      </group>
      {/* Animated falling indicator droplet */}
      <group position={[BEAKER_X, PIPETTE_Y - 0.012, BENCH_Z]} ref={dropRef}>
        <IndicatorDroplet color={liquidColor} />
      </group>
      {/* pH reference colour strip card on slotted matte acrylic stand */}
      <group
        position={[0.115, TILE_TOP_Y, BENCH_Z + 0.005]}
        rotation={[0, -0.22, 0]}
      >
        <PhReferenceCard ph={reading.ph} />
      </group>
      {/* Adaptive theme-aware labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.065, 0.285, BENCH_Z]}
      >
        <span>{parts.dropper}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.075, 0.185, BENCH_Z + 0.015]}
      >
        <span>{parts.phStrip}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.115, 0.148, BENCH_Z + 0.035]}
      >
        <span>{parts.beaker}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.135, 0.072, BENCH_Z + 0.035]}
      >
        <span>{parts.solution}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.048, 0.038, BENCH_Z + 0.075]}
      >
        <span>{parts.ionCloud}</span>
      </ThreeLabel>
    </group>
  );
}
