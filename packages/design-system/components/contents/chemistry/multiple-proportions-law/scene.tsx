import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import type { ElementName } from "@repo/design-system/components/contents/chemistry/element";
import {
  CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH,
  ChemistryParticleLabel,
  getChemistryParticleLabelPosition,
} from "@repo/design-system/components/contents/chemistry/label";
import type {
  MultipleProportionsAtom,
  MultipleProportionsCompoundModel,
  MultipleProportionsModeId,
  MultipleProportionsMolecule,
  MultipleProportionsSceneColors,
} from "@repo/design-system/components/contents/chemistry/multiple-proportions-law/data";
import { MULTIPLE_PROPORTIONS_MODELS } from "@repo/design-system/components/contents/chemistry/multiple-proportions-law/data";
import {
  AtomSphere,
  FormulaPlaque,
  MultiBond,
} from "@repo/design-system/components/contents/chemistry/specimen";
import { atomSymbol } from "@repo/design-system/components/contents/chemistry/symbol";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getThreeParticleLabelFontSize } from "@repo/design-system/components/three/data/constants";
import { Turn } from "@repo/design-system/components/three/form/part";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { useRequired } from "@repo/design-system/hooks/required";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr, HashMap, Match, Option } from "effect";
import type { ReactNode, RefObject } from "react";
import { createContext, useRef } from "react";
import type { Group } from "three";

const FIRST_X = -0.175;
const SECOND_X = 0.175;
const STAGE_Z = 0.035;
const MOLECULE_Y = 0.128;

const WATCH_GLASS_PROFILE = [
  [0, 0.004],
  [0.056, 0.005],
  [0.098, 0.013],
  [0.122, 0.026],
  [0.125, 0.028],
  [0.12, 0.029],
  [0.095, 0.017],
  [0.054, 0.009],
  [0, 0.008],
] as const;

const MultipleProportionsSceneColorsContext =
  createContext<MultipleProportionsSceneColors | null>(null);

/** Provides the colors of one multiple-proportions lab to the parts of its scene. */
export function MultipleProportionsSceneColorsProvider({
  children,
  colors,
}: {
  children: ReactNode;
  colors: MultipleProportionsSceneColors;
}) {
  return (
    <MultipleProportionsSceneColorsContext value={colors}>
      {children}
    </MultipleProportionsSceneColorsContext>
  );
}

/** Reads the colors of the surrounding multiple-proportions lab. */
function useMultipleProportionsSceneColors() {
  return useRequired(
    MultipleProportionsSceneColorsContext,
    "useMultipleProportionsSceneColors"
  );
}

function WatchGlassPedestal({
  children,
  plaqueFormula,
  plaqueSubtitle,
  x,
}: {
  readonly children: ReactNode;
  readonly plaqueFormula: string;
  readonly plaqueSubtitle: string;
  readonly x: number;
}) {
  return (
    <group position={[x, 0, STAGE_Z]}>
      <mesh castShadow position={[0, 0.005, 0]} receiveShadow>
        <cylinderGeometry args={[0.096, 0.104, 0.01, 48]} />
        <meshPhysicalMaterial
          clearcoat={0.35}
          color={CAR_COLORS.dashboard}
          metalness={0.5}
          roughness={0.38}
        />
      </mesh>
      <mesh position={[0, 0.011, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.095, 0.0024, 12, 56]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
      </mesh>
      <mesh castShadow position={[0, 0.009, 0]}>
        <Turn profile={WATCH_GLASS_PROFILE} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.34} />
      </mesh>
      <FormulaPlaque
        formula={plaqueFormula}
        position={[0, 0.025, 0.118]}
        subtitle={plaqueSubtitle}
        width={0.118}
      />
      <group position={[0, MOLECULE_Y, 0]}>{children}</group>
    </group>
  );
}

function RatioComparator({ ratioText }: { readonly ratioText: string }) {
  return (
    <group position={[0, 0, STAGE_Z - 0.01]}>
      <mesh castShadow position={[0, 0.006, 0]} receiveShadow>
        <cylinderGeometry args={[0.032, 0.038, 0.012, 28]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
      </mesh>
      <mesh castShadow position={[0, 0.068, 0]}>
        <cylinderGeometry args={[0.0046, 0.0052, 0.12, 18]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.22} />
      </mesh>
      <FormulaPlaque
        formula={ratioText}
        position={[0, 0.128, 0.008]}
        subtitle="O MASS RATIO"
        width={0.094}
      />
    </group>
  );
}

export function MultipleProportionsScene({
  modeId,
}: {
  modeId: MultipleProportionsModeId;
}) {
  const model = MULTIPLE_PROPORTIONS_MODELS[modeId];
  const firstRef = useRef<Group>(null);
  const secondRef = useRef<Group>(null);
  const { advance, playing } = useSimulationClock(0);

  useFrame((_, delta) => {
    const t = advance(delta);
    if (firstRef.current !== null) {
      firstRef.current.rotation.y = Math.sin(t * 0.85) * 0.48;
      firstRef.current.position.y = Math.sin(t * 1.4) * 0.004;
    }
    if (secondRef.current !== null) {
      secondRef.current.rotation.y = -Math.sin(t * 0.85) * 0.48;
      secondRef.current.position.y = Math.cos(t * 1.4) * 0.004;
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <LabBench width={2.6} />
      <RatioComparator ratioText={model.ratioText} />
      <CompoundStage groupRef={firstRef} model={model.first} x={FIRST_X} />
      <CompoundStage groupRef={secondRef} model={model.second} x={SECOND_X} />
    </group>
  );
}

function CompoundStage({
  groupRef,
  model,
  x,
}: {
  readonly groupRef: RefObject<Group | null>;
  readonly model: MultipleProportionsCompoundModel;
  readonly x: number;
}) {
  const labelInk = useLabelInk();
  return (
    <group>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[x, 0.232, STAGE_Z]}
      >
        <InlineMath math={model.formula} />
      </ThreeLabel>
      <WatchGlassPedestal
        plaqueFormula={model.plaqueFormula}
        plaqueSubtitle={model.plaqueSubtitle}
        x={x}
      >
        <group ref={groupRef}>
          {Arr.map(model.molecules, (molecule) => (
            <Molecule key={molecule.id} molecule={molecule} />
          ))}
        </group>
      </WatchGlassPedestal>
    </group>
  );
}

function Molecule({ molecule }: { molecule: MultipleProportionsMolecule }) {
  const colors = useMultipleProportionsSceneColors();
  const atomsById = HashMap.fromIterable(
    Arr.map(molecule.atoms, (atomData) => [atomData.id, atomData])
  );

  return (
    <group position={molecule.position}>
      {Arr.map(molecule.bonds, ([startId, endId, order]) => {
        const start = HashMap.get(atomsById, startId);
        const end = HashMap.get(atomsById, endId);

        if (Option.isNone(start) || Option.isNone(end)) {
          return null;
        }

        return (
          <MultiBond
            color={colors.bond}
            end={end.value.position}
            gap={0.0062}
            key={`${startId}-${endId}`}
            order={order}
            radius={0.0038}
            start={start.value.position}
          />
        );
      })}

      {Arr.map(molecule.atoms, (atomData) => (
        <AtomParticle atomData={atomData} key={atomData.id} />
      ))}
    </group>
  );
}

function AtomParticle({ atomData }: { atomData: MultipleProportionsAtom }) {
  const colors = useMultipleProportionsSceneColors();
  const radius = atomRadius(atomData.element);

  return (
    <group position={atomData.position}>
      <AtomSphere
        color={atomColor(atomData.element, colors)}
        position={[0, 0, 0]}
        radius={radius}
      />
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
  return Match.value(element).pipe(
    Match.when("hydrogen", () => 0.0165),
    Match.when("carbon", () => 0.0235),
    Match.when("nitrogen", () => 0.0245),
    Match.when("oxygen", () => 0.0255),
    Match.exhaustive
  );
}

function atomColor(
  element: ElementName,
  colors: MultipleProportionsSceneColors
) {
  return Match.value(element).pipe(
    Match.when("carbon", () => colors.carbon),
    Match.when("hydrogen", () => colors.hydrogen),
    Match.when("nitrogen", () => colors.nitrogen),
    Match.when("oxygen", () => colors.oxygen),
    Match.exhaustive
  );
}
