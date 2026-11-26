import { useFrame } from "@react-three/fiber";
import type { ElementName } from "@repo/design-system/components/contents/chemistry/element";
import {
  CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH,
  ChemistryParticleLabel,
  getChemistryParticleLabelPosition,
} from "@repo/design-system/components/contents/chemistry/label";
import type {
  MatterParticleAtom,
  MatterParticleModeId,
  MatterParticleMolecule,
  MatterParticleSceneColors,
} from "@repo/design-system/components/contents/chemistry/matter-particle-reader/data";
import { MATTER_PARTICLE_MODELS } from "@repo/design-system/components/contents/chemistry/matter-particle-reader/data";
import { atomSymbol } from "@repo/design-system/components/contents/chemistry/symbol";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getThreeParticleLabelFontSize } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { useRequired } from "@repo/design-system/hooks/required";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr, HashMap, Option } from "effect";
import type { ReactNode } from "react";
import { createContext, useMemo, useRef } from "react";
import type { Group } from "three";
import { Quaternion, Vector3 } from "three";

const SCENE_SCALE = 1.9;
const FORMULA_LABEL_Y = 0.62;
const UP = new Vector3(0, 1, 0);

const MatterParticleSceneColorsContext =
  createContext<MatterParticleSceneColors | null>(null);

/** Provides the colors of one matter-particle lab to the atoms of its scene. */
export function MatterParticleSceneColorsProvider({
  children,
  colors,
}: {
  children: ReactNode;
  colors: MatterParticleSceneColors;
}) {
  return (
    <MatterParticleSceneColorsContext value={colors}>
      {children}
    </MatterParticleSceneColorsContext>
  );
}

/** Reads the colors of the surrounding matter-particle lab. */
function useMatterParticleSceneColors() {
  return useRequired(
    MatterParticleSceneColorsContext,
    "useMatterParticleSceneColors"
  );
}

function BondCylinder({
  color,
  end,
  start,
}: {
  readonly color: string;
  readonly end: readonly [number, number, number];
  readonly start: readonly [number, number, number];
}) {
  const { length, mid, quat } = useMemo(() => {
    const a = new Vector3(start[0], start[1], start[2]);
    const b = new Vector3(end[0], end[1], end[2]);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const q = new Quaternion().setFromUnitVectors(UP, dir.normalize());
    return {
      length: len,
      mid: a.clone().add(b).multiplyScalar(0.5),
      quat: q,
    };
  }, [end, start]);

  return (
    <mesh castShadow position={mid} quaternion={quat}>
      <cylinderGeometry args={[0.028, 0.028, length, 16]} />
      <MetalMaterial color={color} roughness={0.28} />
    </mesh>
  );
}

export function MatterParticleReaderScene({
  modeId,
}: {
  modeId: MatterParticleModeId;
}) {
  const model = MATTER_PARTICLE_MODELS[modeId];
  const { advance, playing } = useSimulationClock(0);
  const spinRef = useRef<Group>(null);

  useFrame((_, delta) => {
    const t = advance(delta);
    if (spinRef.current !== null) {
      spinRef.current.rotation.y = Math.sin(t * 0.75) * 0.32;
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <group position={[0, -0.04, 0]} ref={spinRef} scale={SCENE_SCALE}>
        {Arr.map(model.molecules, (molecule) => (
          <MoleculeStage key={molecule.id} molecule={molecule} />
        ))}
      </group>
    </group>
  );
}

function MoleculeStage({ molecule }: { molecule: MatterParticleMolecule }) {
  const colors = useMatterParticleSceneColors();
  const atomsById = HashMap.fromIterable(
    Arr.map(molecule.atoms, (atomData) => [atomData.id, atomData])
  );

  return (
    <group position={molecule.position} scale={molecule.scale ?? 1}>
      {/* Sleek dark-anodised studio specimen plinth & brass pin */}
      <group position={[0, -0.35, 0]}>
        <mesh castShadow position={[0, -0.025, 0]} receiveShadow>
          <cylinderGeometry args={[0.3, 0.34, 0.05, 40]} />
          <meshPhysicalMaterial
            clearcoat={0.35}
            color={BENCH_COLORS.epoxy}
            metalness={0.25}
            roughness={0.48}
          />
        </mesh>
        <mesh position={[0, 0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.29, 0.01, 10, 48]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
        </mesh>
        <mesh castShadow position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.016, 0.02, 0.24, 16]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
        </mesh>
      </group>

      <ThreeLabel
        color={colors.text}
        fontSize="compact"
        position={[0, FORMULA_LABEL_Y, 0.32]}
      >
        <InlineMath math={molecule.formula} />
      </ThreeLabel>

      {Arr.map(molecule.bonds, ([startId, endId]) => {
        const start = Option.getOrUndefined(HashMap.get(atomsById, startId));
        const end = Option.getOrUndefined(HashMap.get(atomsById, endId));

        if (!(start && end)) {
          return null;
        }

        return (
          <BondCylinder
            color={colors.bond}
            end={end.position}
            key={`${startId}-${endId}`}
            start={start.position}
          />
        );
      })}

      {Arr.map(molecule.atoms, (atomData) => (
        <AtomParticle atomData={atomData} key={atomData.id} />
      ))}
    </group>
  );
}

function AtomParticle({ atomData }: { atomData: MatterParticleAtom }) {
  const colors = useMatterParticleSceneColors();
  const radius = atomRadius(atomData.element);

  return (
    <group position={atomData.position}>
      <mesh castShadow>
        <sphereGeometry args={[radius, 32, 22]} />
        <meshPhysicalMaterial
          clearcoat={0.72}
          clearcoatRoughness={0.14}
          color={atomColor(atomData.element, colors)}
          roughness={0.24}
        />
      </mesh>
      <ChemistryParticleLabel
        color={colors.sphereText}
        fontSize={getThreeParticleLabelFontSize(radius)}
        outlineColor={colors.sphereTextOutline}
        outlineWidth={CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH}
        position={getChemistryParticleLabelPosition(radius)}
      >
        <InlineMath math={atomSymbol(atomData.element)} />
      </ChemistryParticleLabel>
    </group>
  );
}

function atomRadius(element: ElementName) {
  if (element === "hydrogen") {
    return 0.1;
  }

  return 0.15;
}

function atomColor(element: ElementName, colors: MatterParticleSceneColors) {
  if (element === "carbon") {
    return colors.carbon;
  }

  if (element === "hydrogen") {
    return colors.hydrogen;
  }

  if (element === "nitrogen") {
    return colors.nitrogen;
  }

  return colors.oxygen;
}
