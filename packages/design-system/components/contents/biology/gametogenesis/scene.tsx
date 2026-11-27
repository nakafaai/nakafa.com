import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  CellKey,
  Level,
  Sex,
} from "@repo/design-system/components/contents/biology/gametogenesis/division";
import type { AnatomyPart } from "@repo/design-system/components/contents/biology/gametogenesis/organs";
import {
  GonadView,
  SystemView,
} from "@repo/design-system/components/contents/biology/gametogenesis/organs";
import { useBumpySphere } from "@repo/design-system/components/contents/biology/surface";
import {
  BiologyBenchSurface,
  SlideStage,
} from "@repo/design-system/components/contents/biology/workbench";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.88, 2.34];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.56, 0];
const STEP_SECONDS = 2.2;

/** Ultra-detailed flagellated spermatozoon with acrosome cap, helical mitochondrial sheath, and sinusoidal tail. */
function SpermatozoonSpecimen({
  ink,
  parts,
}: {
  readonly ink: string;
  readonly parts: Readonly<Record<AnatomyPart, string>>;
}) {
  const { flagellumGeo, mitoHelixGeo } = useMemo(() => {
    // Helical mitochondrial sheath spiraling around the midpiece
    const mitoPts = Arr.makeBy(42, (i) => {
      const t = i / 41;
      const angle = t * Math.PI * 10;
      return new Vector3(
        -0.33 + t * 0.25,
        Math.cos(angle) * 0.042,
        Math.sin(angle) * 0.042
      );
    });
    const mitoHelix = new TubeGeometry(
      new CatmullRomCurve3(mitoPts),
      64,
      0.015,
      10,
      false
    );

    // Gracefully undulating flagellum tail
    const tailCurve = new CatmullRomCurve3([
      new Vector3(-0.08, 0, 0),
      new Vector3(0.14, 0.048, 0.025),
      new Vector3(0.38, -0.042, -0.02),
      new Vector3(0.62, 0.036, 0.018),
      new Vector3(0.84, -0.015, 0),
    ]);
    const flagellum = new TubeGeometry(tailCurve, 44, 0.013, 10, false);

    return {
      flagellumGeo: flagellum,
      mitoHelixGeo: mitoHelix,
    };
  }, []);

  useEffect(
    () => () => {
      mitoHelixGeo.dispose();
      flagellumGeo.dispose();
    },
    [flagellumGeo, mitoHelixGeo]
  );

  return (
    <group position={[0, 0.58, 0]}>
      {/* Streamlined golden acrosome cap fitting cleanly over the anterior half of the sperm head */}
      <mesh
        castShadow
        position={[-0.512, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[0.95, 1.42, 0.75]}
      >
        <sphereGeometry
          args={[0.108, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.44]}
        />
        <meshPhysicalMaterial
          clearcoat={0.85}
          clearcoatRoughness={0.16}
          color={BIOLOGY_COLORS.acrosomeGold}
          roughness={0.22}
        />
      </mesh>
      {/* Streamlined flattened pyriform haploid nucleus head */}
      <mesh castShadow position={[-0.5, 0, 0]} scale={[1.38, 0.92, 0.72]}>
        <sphereGeometry args={[0.105, 28, 22]} />
        <meshPhysicalMaterial
          clearcoat={0.76}
          clearcoatRoughness={0.22}
          color={BIOLOGY_COLORS.spermHeadBlue}
          roughness={0.28}
        />
      </mesh>
      {/* Midpiece central axoneme core + spiral mitochondrial sheath */}
      <mesh castShadow position={[-0.205, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.024, 0.26, 18]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={BIOLOGY_COLORS.flagellumIvory}
          roughness={0.36}
        />
      </mesh>
      <mesh castShadow geometry={mitoHelixGeo}>
        <meshPhysicalMaterial
          clearcoat={0.72}
          clearcoatRoughness={0.22}
          color={BIOLOGY_COLORS.midpieceCopper}
          roughness={0.28}
        />
      </mesh>
      {/* Undulating flagellum tail */}
      <mesh castShadow geometry={flagellumGeo}>
        <meshPhysicalMaterial
          clearcoat={0.55}
          color={BIOLOGY_COLORS.flagellumIvory}
          roughness={0.34}
        />
      </mesh>

      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[-0.66, 0.2, 0]}
      >
        {parts.acrosome}
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[-0.5, -0.18, 0]}
      >
        {parts.head}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[-0.2, 0.16, 0]}
      >
        {parts.middle}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[0.42, 0.14, 0]}
      >
        {parts.tail}
      </ThreeLabel>
    </group>
  );
}

/** Yolk-rich mature oocyte surrounded by translucent zona pellucida, follicular antrum, and corona radiata. */
function OocyteSpecimen({
  ink,
  parts,
}: {
  readonly ink: string;
  readonly parts: Readonly<Record<AnatomyPart, string>>;
}) {
  const yolkGeo = useBumpySphere(0.28, 12, 0.024);

  const coronaCells = useMemo(
    () =>
      Arr.makeBy(18, (idx) => {
        const ring = idx < 12 ? 0 : 1;
        const count = ring === 0 ? 12 : 6;
        const local = ring === 0 ? idx : idx - 12;
        const angle = (local / count) * Math.PI * 2 + ring * 0.4;
        const dist = ring === 0 ? 0.39 : 0.37;
        let z = Math.sin(idx * 1.7) * 0.08;
        if (ring !== 0) {
          z = local % 2 === 0 ? 0.16 : -0.16;
        }
        return {
          id: `cor-${idx}`,
          pos: [Math.cos(angle) * dist, Math.sin(angle) * dist, z] as const,
        };
      }),
    []
  );

  return (
    <group position={[0, 0.58, 0]}>
      {/* Translucent glossy zona pellucida glycoprotein coat */}
      <mesh castShadow>
        <sphereGeometry args={[0.34, 36, 28]} />
        <meshPhysicalMaterial
          clearcoat={0.82}
          clearcoatRoughness={0.14}
          color={BIOLOGY_COLORS.zonaPellucida}
          opacity={0.44}
          roughness={0.18}
          transparent
        />
      </mesh>
      {/* Organic yolk-rich oocyte ooplasm */}
      <mesh castShadow geometry={yolkGeo}>
        <meshPhysicalMaterial
          clearcoat={0.46}
          color={BIOLOGY_COLORS.oocyteYolk}
          opacity={0.86}
          roughness={0.34}
          transparent
        />
      </mesh>
      {/* Eccentric haploid egg nucleus */}
      <mesh position={[-0.06, 0.04, 0.06]}>
        <sphereGeometry args={[0.105, 24, 20]} />
        <meshPhysicalMaterial
          clearcoat={0.62}
          color={BIOLOGY_COLORS.eggNucleus}
          roughness={0.32}
        />
      </mesh>
      {/* First polar body tucked inside perivitelline space */}
      <mesh castShadow position={[-0.22, 0.18, 0.12]}>
        <sphereGeometry args={[0.048, 16, 14]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={PLOT_COLORS.slate}
          roughness={0.38}
        />
      </mesh>
      {/* Fluid-filled follicular antrum pocket */}
      <mesh position={[0.24, -0.04, 0.15]}>
        <sphereGeometry args={[0.125, 20, 16]} />
        <meshPhysicalMaterial
          clearcoat={0.85}
          color={BIOLOGY_COLORS.follicleFluid}
          opacity={0.62}
          roughness={0.16}
          transparent
        />
      </mesh>
      {/* Radial corona radiata follicular cell layer */}
      {Arr.map(coronaCells, (cell) => (
        <mesh castShadow key={cell.id} position={cell.pos}>
          <sphereGeometry args={[0.05, 16, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.4}
            color={BIOLOGY_COLORS.coronaCell}
            roughness={0.46}
          />
        </mesh>
      ))}
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[0.48, 0.24, 0]}
      >
        {parts.follicular}
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[0.42, -0.14, 0.12]}
      >
        {parts.antrum}
      </ThreeLabel>
    </group>
  );
}

/**
 * 3D gametogenesis scene covering four zoom levels: reproductive tract
 * (`system`), gonad cross-section (`gonad`), meiotic cell division (`meiosis`),
 * and mature gamete ultrastructure (`gamete`) for male and female sexes.
 */
export function GametogenesisScene({
  cells,
  level,
  onStep,
  parts,
  sex,
  step,
}: {
  readonly cells: Readonly<Record<CellKey, string>>;
  readonly level: Level;
  readonly onStep: (next: number) => void;
  readonly parts: Readonly<Record<AnatomyPart, string>>;
  readonly sex: Sex;
  readonly step: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const ink = useLabelInk();
  const rootRef = useRef<Group>(null);
  const timer = useRef(0);
  const phase = useRef(0);

  const rewind = () => {
    timer.current = 0;
    phase.current = 0;
    if (rootRef.current !== null) {
      rootRef.current.rotation.set(0, 0, 0);
    }
    invalidate();
  };

  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing) {
      timer.current = 0;
      return;
    }
    const dt = simulationStep(delta);
    phase.current += dt;
    if (level === "meiosis") {
      timer.current += dt;
      if (timer.current >= STEP_SECONDS) {
        timer.current = 0;
        onStep((step + 1) % 4);
      }
    } else if (rootRef.current !== null) {
      rootRef.current.rotation.y = Math.sin(phase.current * 0.65) * 0.28;
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={38}
      />

      <BiologyBenchSurface radius={12} y={0} />
      <SlideStage position={[0, 0, 0]} radius={0.98} />

      <group ref={rootRef}>
        {Match.value(level).pipe(
          Match.when("system", () => <SystemView parts={parts} sex={sex} />),
          Match.when("gonad", () => <GonadView parts={parts} sex={sex} />),
          Match.when("meiosis", () => {
            let xs: readonly number[] = [-0.54, -0.18, 0.18, 0.54];
            if (step <= 1) {
              xs = [0];
            } else if (step === 2) {
              xs = [-0.32, 0.32];
            }
            const count = xs.length;
            return (
              <group>
                {Arr.map(xs, (x, idx) => {
                  const isPolar = sex === "female" && count > 1 && idx > 0;
                  let radius = 0.15;
                  if (isPolar) {
                    radius = 0.072;
                  } else if (step === 1) {
                    radius = 0.22;
                  } else if (sex === "female") {
                    radius = 0.19;
                  }
                  let fill: string = BIOLOGY_COLORS.oocyteYolk;
                  if (isPolar) {
                    fill = PLOT_COLORS.slate;
                  } else if (sex === "male") {
                    fill = BIOLOGY_COLORS.spermHeadBlue;
                  }
                  return (
                    <group key={x} position={[x, 0.58, 0]}>
                      {/* Translucent plasma membrane + cytoplasm */}
                      <mesh castShadow>
                        <sphereGeometry args={[radius, 28, 22]} />
                        <meshPhysicalMaterial
                          clearcoat={0.72}
                          clearcoatRoughness={0.2}
                          color={fill}
                          opacity={0.56}
                          roughness={0.24}
                          transparent
                        />
                      </mesh>
                      {/* Stained chromatin nucleus */}
                      <mesh>
                        <sphereGeometry args={[radius * 0.46, 20, 16]} />
                        <meshPhysicalMaterial
                          clearcoat={0.55}
                          color={CELL_COLORS.nucleus}
                          roughness={0.34}
                        />
                      </mesh>
                      {isPolar && idx === 1 ? (
                        <ThreeLabel
                          anchorY="top"
                          color={ink}
                          fontSize="compact"
                          gap={0.05}
                          position={[0, -0.14, 0]}
                        >
                          {cells.polarBody}
                        </ThreeLabel>
                      ) : null}
                    </group>
                  );
                })}
              </group>
            );
          }),
          Match.when("gamete", () =>
            sex === "male" ? (
              <SpermatozoonSpecimen ink={ink} parts={parts} />
            ) : (
              <OocyteSpecimen ink={ink} parts={parts} />
            )
          ),
          Match.exhaustive
        )}
      </group>
    </group>
  );
}
