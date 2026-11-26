import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { latheProfile } from "@repo/design-system/components/contents/chemistry/glassware";
import type { CondensationPolymer } from "@repo/design-system/components/contents/chemistry/nylon/model";
import {
  AtomSphere,
  BondCylinder,
  FormulaPlaque,
  LabeledVial,
  MultiBond,
  SpecimenPlinth,
} from "@repo/design-system/components/contents/chemistry/specimen";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { LatheGeometry } from "three";

export const RIG_Z = 0.04;
export const CHAIN_Y = 0.195;
export const STANCHION_X = 0.262;

const CATCH_DISH_PROFILE = latheProfile([
  [0.001, 0.002],
  [0.036, 0.003],
  [0.062, 0.009],
  [0.075, 0.018],
  [0.077, 0.019],
  [0.073, 0.02],
  [0.059, 0.011],
  [0.034, 0.005],
  [0.001, 0.004],
]);

const BENZENE_ANGLES = Arr.makeBy(6, (idx) => (idx / 6) * Math.PI * 2);

/** Condensation polymer bench rig with labelled monomer vials, chrome stanchions, and H₂O watch glass. */
export function CondensationBenchBase({
  polymer,
}: {
  readonly polymer: CondensationPolymer;
}) {
  const dishGeo = useMemo(() => new LatheGeometry(CATCH_DISH_PROFILE, 44), []);
  useEffect(() => () => dishGeo.dispose(), [dishGeo]);

  const isNylon = polymer === "nylon66";

  return (
    <group>
      <LabBench width={2.6} />
      <group position={[0, 0, RIG_Z]}>
        <SpecimenPlinth depth={0.21} height={0.015} width={0.6} />

        {/* Twin vertical chrome mounting stanchions with brass clamps */}
        {Arr.map([-STANCHION_X, STANCHION_X] as const, (x) => (
          <group key={x} position={[x, 0.028, 0]}>
            <mesh castShadow position={[0, 0.008, 0]}>
              <cylinderGeometry args={[0.014, 0.016, 0.016, 24]} />
              <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
            </mesh>
            <mesh castShadow position={[0, 0.088, 0]}>
              <cylinderGeometry args={[0.0055, 0.0058, 0.165, 20]} />
              <MetalMaterial color={CAR_COLORS.chrome} roughness={0.2} />
            </mesh>
            <mesh castShadow position={[0, CHAIN_Y - 0.028, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 0.022, 20]} />
              <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
            </mesh>
          </group>
        ))}

        {/* Small borosilicate watch glass catching eliminated H₂O condensate */}
        <group position={[0, 0.028, 0.022]}>
          <mesh position={[0, 0.002, 0]} receiveShadow>
            <cylinderGeometry args={[0.044, 0.048, 0.004, 32]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
          </mesh>
          <mesh castShadow geometry={dishGeo} position={[0, 0.003, 0]}>
            <GlassMaterial color={BENCH_COLORS.glass} opacity={0.36} />
          </mesh>
        </group>

        {/* Engraved front formula plaque */}
        <FormulaPlaque
          formula={isNylon ? "-CONH-" : "-COO-"}
          position={[0, 0.036, 0.118]}
          subtitle={isNylon ? "NYLON-6,6 AMIDE" : "TERYLENE ESTER"}
          width={0.148}
        />

        {/* Flanking labelled borosilicate monomer reagent vials */}
        <LabeledVial
          chemicalName={isNylon ? "Diaminohexane" : "Ethane-1,2-diol"}
          concentration={isNylon ? "0.5 M" : "Pure"}
          fillHeight={0.046}
          formula={isNylon ? "C₆H₁₆N₂" : "C₂H₆O₂"}
          liquidColor={
            isNylon ? REAGENT_COLORS.copperSulfate : REAGENT_COLORS.solution
          }
          position={[-0.355, 0, 0.01]}
          stripeColor={BENCH_COLORS.bottleStripeSalt}
        />
        <LabeledVial
          chemicalName={isNylon ? "Adipic Acid" : "Terephthalic Acid"}
          concentration={isNylon ? "0.5 M" : "0.4 M"}
          fillHeight={0.042}
          formula={isNylon ? "C₆H₁₀O₄" : "C₈H₆O₄"}
          liquidColor={
            isNylon ? REAGENT_COLORS.vinegar : PROCESS_COLORS.phenolPink
          }
          position={[0.355, 0, 0.01]}
          stripeColor={
            isNylon
              ? BENCH_COLORS.bottleStripeBase
              : BENCH_COLORS.bottleStripeAcid
          }
        />
      </group>
    </group>
  );
}

/** Aliphatic hydrocarbon chain segment (-(CH₂)n-) with glossy carbon & hydrogen atoms. */
export function HydrocarbonBlock({
  accentColor,
  x,
}: {
  readonly accentColor: string;
  readonly x: number;
}) {
  const carbons = [
    [-0.036, -0.008, 0],
    [-0.012, 0.009, 0.004],
    [0.012, -0.009, -0.004],
    [0.036, 0.008, 0],
  ] as const;

  return (
    <group position={[x, 0, 0]}>
      {/* Subtle translucent block collar framing the monomer repeat unit */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.088, 28]} />
        <meshPhysicalMaterial
          clearcoat={0.7}
          color={accentColor}
          depthWrite={false}
          opacity={0.22}
          roughness={0.18}
          transparent
        />
      </mesh>
      {Arr.map(Arr.range(0, 2), (idx) => (
        <BondCylinder
          end={carbons[idx + 1] ?? [0, 0, 0]}
          key={`cc-${idx}`}
          radius={0.0034}
          start={carbons[idx] ?? [0, 0, 0]}
        />
      ))}
      {Arr.map(carbons, (pos, idx) => {
        const yDir = idx % 2 === 0 ? -0.018 : 0.018;
        const h1 = [pos[0], pos[1] + yDir, pos[2] + 0.013] as const;
        const h2 = [pos[0], pos[1] + yDir, pos[2] - 0.013] as const;
        return (
          <group key={`c-${pos[0]}-${pos[1]}`}>
            <AtomSphere
              color={ORGANIC_COLORS.carbonDark}
              position={pos}
              radius={0.0095}
            />
            <BondCylinder end={h1} radius={0.002} start={pos} />
            <AtomSphere
              color={ORGANIC_COLORS.hydrogenWhite}
              position={h1}
              radius={0.0056}
            />
            <BondCylinder end={h2} radius={0.002} start={pos} />
            <AtomSphere
              color={ORGANIC_COLORS.hydrogenWhite}
              position={h2}
              radius={0.0056}
            />
          </group>
        );
      })}
    </group>
  );
}

/** Aromatic benzene ring (-C₆H₄-) block for Terylene polyester monomer units. */
export function BenzeneBlock({
  accentColor,
  x,
}: {
  readonly accentColor: string;
  readonly x: number;
}) {
  const ringR = 0.028;
  const vertices = Arr.map(
    BENZENE_ANGLES,
    (ang) => [Math.cos(ang) * ringR, Math.sin(ang) * ringR, 0] as const
  );

  return (
    <group position={[x, 0, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.036, 0.036, 0.088, 28]} />
        <meshPhysicalMaterial
          clearcoat={0.7}
          color={accentColor}
          depthWrite={false}
          opacity={0.18}
          roughness={0.18}
          transparent
        />
      </mesh>
      {/* Conjugated delocalised pi-electron ring */}
      <mesh>
        <torusGeometry args={[ringR * 0.64, 0.002, 10, 36]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.24} />
      </mesh>
      {Arr.map(vertices, (pt, idx) => {
        const next = vertices[(idx + 1) % 6] ?? [0, 0, 0];
        return (
          <group key={`bz-${pt[0].toFixed(4)}-${pt[1].toFixed(4)}`}>
            <BondCylinder end={next} radius={0.003} start={pt} />
            <AtomSphere
              color={ORGANIC_COLORS.carbonDark}
              position={pt}
              radius={0.0086}
            />
          </group>
        );
      })}
    </group>
  );
}

/** 3D amide (-CO-NH-) or ester (-CO-O-) condensation linkage with carbonyl C=O double bond. */
export function CondensationLinkage({
  isAmide,
  x,
}: {
  readonly isAmide: boolean;
  readonly x: number;
}) {
  const carbonylC = [-0.015, 0, 0] as const;
  const carbonylO = [-0.015, 0.03, 0] as const;
  const heteroPos = [0.015, 0, 0] as const;
  const amideH = [0.015, -0.026, 0.006] as const;
  const linkAccent = isAmide
    ? ORGANIC_COLORS.amideBlue
    : ORGANIC_COLORS.esterRose;

  return (
    <group position={[x, 0, 0]}>
      {/* Bridge bonds into adjacent monomer units */}
      <BondCylinder
        color={linkAccent}
        end={carbonylC}
        radius={0.0036}
        start={[-0.044, 0, 0]}
      />
      <BondCylinder
        color={linkAccent}
        end={[0.044, 0, 0]}
        radius={0.0036}
        start={heteroPos}
      />
      {/* C-N or C-O backbone bond */}
      <BondCylinder
        color={linkAccent}
        emissive={linkAccent}
        emissiveIntensity={0.3}
        end={heteroPos}
        radius={0.0042}
        start={carbonylC}
      />
      {/* Carbonyl C=O double bond */}
      <MultiBond
        color={ORGANIC_COLORS.doubleBondGold}
        emissive={ORGANIC_COLORS.doubleBondGold}
        emissiveIntensity={0.32}
        end={carbonylO}
        gap={0.0052}
        order={2}
        radius={0.0028}
        start={carbonylC}
      />
      <AtomSphere
        color={ORGANIC_COLORS.carbonDark}
        position={carbonylC}
        radius={0.0096}
      />
      <AtomSphere
        color={ORGANIC_COLORS.furnaceRed}
        position={carbonylO}
        radius={0.0092}
      />
      {/* Amide N-H (blue nitrogen + white H) or Ester bridging O (crimson oxygen) */}
      <AtomSphere
        color={linkAccent}
        emissive={linkAccent}
        emissiveIntensity={0.22}
        position={heteroPos}
        radius={0.0102}
      />
      {isAmide ? (
        <group>
          <BondCylinder end={amideH} radius={0.0022} start={heteroPos} />
          <AtomSphere
            color={ORGANIC_COLORS.hydrogenWhite}
            position={amideH}
            radius={0.0062}
          />
        </group>
      ) : null}
    </group>
  );
}

/** Bent 3D ball-and-stick H₂O molecule (104.5 degree bond angle) eliminated during condensation. */
export function WaterMolecule3D() {
  const oxygen = [0, 0.003, 0] as const;
  const hLeft = [-0.014, -0.007, 0.003] as const;
  const hRight = [0.014, -0.007, -0.003] as const;

  return (
    <group>
      <BondCylinder end={hLeft} radius={0.0022} start={oxygen} />
      <BondCylinder end={hRight} radius={0.0022} start={oxygen} />
      <AtomSphere
        color={ORGANIC_COLORS.waterBlue}
        emissive={ORGANIC_COLORS.waterBlue}
        emissiveIntensity={0.22}
        position={oxygen}
        radius={0.0094}
      />
      <AtomSphere
        color={ORGANIC_COLORS.hydrogenWhite}
        position={hLeft}
        radius={0.0062}
      />
      <AtomSphere
        color={ORGANIC_COLORS.hydrogenWhite}
        position={hRight}
        radius={0.0062}
      />
    </group>
  );
}
