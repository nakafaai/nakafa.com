import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  ChloroplastReading,
  ChloroplastStage,
} from "@repo/design-system/components/contents/biology/chloroplast/model";
import {
  ChloroplastEnvelope,
  ChloroplastInterior,
  Thylakoids,
} from "@repo/design-system/components/contents/biology/chloroplast/organelles";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MoleculeModel } from "@repo/design-system/components/three/molecule/kit";
import type { Small } from "@repo/design-system/components/three/molecule/small";
import { smallOf } from "@repo/design-system/components/three/molecule/small";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr } from "effect";
import { useCallback, useMemo, useRef } from "react";
import type { Group } from "three";
import { AdditiveBlending, DoubleSide } from "three";

const PHOTON_BEAMS = [-0.58, -0.24, 0.12] as const;

/**
 * One molecule that enters or leaves the chloroplast, as a model of its real
 * atoms: the gases and water space filling, the larger carriers ball and
 * stick. It is drawn far larger than life beside the organelle, as a sign of
 * what flows where.
 */
function Carrier({
  at,
  name,
  size,
}: {
  readonly at: readonly [number, number, number];
  readonly name: Small;
  readonly size: number;
}) {
  const molecule = useMemo(() => smallOf(name), [name]);
  return (
    <group position={at} rotation={[0.3, 0.5, 0.2]} scale={size}>
      <MoleculeModel
        molecule={molecule}
        style={molecule.atoms.length > 3 ? "sticks" : "spheres"}
      />
    </group>
  );
}

function ChloroplastCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.45, 2.3, 4.4] : [0.35, 1.72, 3.15]}
      cameraTarget={[0, 0.48, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.3}
    />
  );
}

export function ChloroplastScene({
  parts,
  reading,
  stage,
}: {
  readonly parts: Readonly<
    Record<
      | "atp"
      | "co2"
      | "glucose"
      | "granum"
      | "nadph"
      | "oxygen"
      | "stroma"
      | "thylakoid"
      | "water",
      string
    >
  >;
  readonly reading: ChloroplastReading;
  readonly stage: ChloroplastStage;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const shuttlesRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const rewind = useCallback(() => {
    phaseRef.current = 0;
    if (shuttlesRef.current !== null) {
      shuttlesRef.current.position.set(0, 0, 0);
    }
  }, []);
  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing || shuttlesRef.current === null) {
      return;
    }
    const speed = 0.8 + reading.photosynthesisRate * 2.2;
    phaseRef.current += simulationStep(delta) * speed;
    shuttlesRef.current.position.x = Math.sin(phaseRef.current) * 0.16;
    shuttlesRef.current.position.y = Math.cos(phaseRef.current * 1.4) * 0.045;
  });

  const granaActive = stage !== "calvinCycle";
  const stromaActive = stage !== "lightDependent";

  return (
    <group>
      <SimulationTicker running={playing} />
      <ChloroplastCamera />
      <ChloroplastEnvelope stromaActive={stromaActive} />
      <ChloroplastInterior>
        <Thylakoids granaActive={granaActive} />
      </ChloroplastInterior>

      {/* Light-harvesting photon flux beams striking the grana stacks */}
      {granaActive
        ? Arr.map(PHOTON_BEAMS, (bx) => (
            <mesh
              key={bx}
              position={[bx - 0.12, 0.86, -0.08]}
              rotation={[0, 0, -0.28]}
            >
              <cylinderGeometry args={[0.03, 0.11, 0.68, 24, 1, true]} />
              <meshBasicMaterial
                blending={AdditiveBlending}
                color={FOLIAGE_COLORS.photonGold}
                depthWrite={false}
                opacity={0.07 + reading.photosynthesisRate * 0.1}
                side={DoubleSide}
                transparent
              />
            </mesh>
          ))
        : null}

      {/* Animated energy and metabolite shuttles */}
      <group ref={shuttlesRef}>
        <Carrier at={[-0.98, 0.62, 0.3]} name="water" size={0.044} />
        <Carrier
          at={[-0.58, 0.92 + reading.photosynthesisRate * 0.12, -0.05]}
          name="oxygen"
          size={0.044}
        />
        <Carrier at={[-0.08, 0.8, 0.5]} name="atp" size={0.02} />
        <Carrier at={[0.38, 0.78, 0.55]} name="nadph" size={0.017} />
        <Carrier at={[1.02, 0.66, 0.1]} name="carbonDioxide" size={0.044} />
        <Carrier at={[0.84, 0.44, 0.48]} name="glucose" size={0.036} />
      </group>

      {/* Well-spaced theme-aware labels */}
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[-0.62, 1.12, -0.14]}
      >
        <span>
          {parts.granum} ({parts.thylakoid})
        </span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.68, 0.22, 0.68]}>
        <span>{parts.stroma}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.78, 0.8, 0.28]}>
        <span>
          {parts.water} / {parts.oxygen}
        </span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.06, 1.12, 0.5]}>
        <span>
          {parts.atp} / {parts.nadph}
        </span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.7, 0.88, 0.1]}>
        <span>
          {parts.co2} / {parts.glucose}
        </span>
      </ThreeLabel>
    </group>
  );
}
