import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import type { RubberState } from "@repo/design-system/components/contents/chemistry/rubber/model";
import {
  AtomSphere,
  BondCylinder,
  FormulaPlaque,
  LabeledVial,
  MultiBond,
  SpecimenPlinth,
} from "@repo/design-system/components/contents/chemistry/specimen";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

export const RIG_Z = 0.04;
export const UPPER_Y = 0.215;
export const LOWER_Y = 0.125;
export const LEFT_JAW_X = -0.22;

const CHAIN_SAMPLES = Arr.range(0, 14);
const CROSSLINK_INDICES = [3, 7, 11] as const;

/** Evaluates a 3D point along a wavy cis-polyisoprene backbone under tensile extension. */
function chainPointAt(
  index: number,
  xOffset: number,
  yCenter: number,
  spanHalf: number,
  waveAmp: number
): readonly [number, number, number] {
  const u = index / 14;
  const x = xOffset - spanHalf + u * spanHalf * 2;
  const y = yCenter + Math.sin(u * Math.PI * 5) * waveAmp;
  const z = Math.cos(u * Math.PI * 5) * (waveAmp * 0.55);
  return [x, y, z] as const;
}

/** Benchtop elastomer tensile-testing frame with fixed jaw, sliding crosshead, dynamometer arrow, and vial. */
export function TensileTestRig({
  rightJawX,
  state,
  strainFactor,
}: {
  readonly rightJawX: number;
  readonly state: RubberState;
  readonly strainFactor: number;
}) {
  const isVulcanised = state === "vulcanisedRubber";
  const arrowLen = 0.052 + strainFactor * 0.036;

  return (
    <group>
      <LabBench width={2.6} />
      <group position={[0, 0, RIG_Z]}>
        <SpecimenPlinth depth={0.21} height={0.015} width={0.62} />

        {/* Twin horizontal polished chrome guide rails */}
        {Arr.map([-0.038, 0.038] as const, (z) => (
          <mesh
            castShadow
            key={z}
            position={[0, 0.042, z]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.0042, 0.0042, 0.58, 18]} />
            <MetalMaterial color={CAR_COLORS.chrome} roughness={0.18} />
          </mesh>
        ))}

        {/* Fixed left cast-iron & brass elastomer jaw pillar */}
        <group position={[LEFT_JAW_X - 0.025, 0.028, 0]}>
          <mesh castShadow position={[0, 0.105, 0]}>
            <boxGeometry args={[0.028, 0.21, 0.098]} />
            <MetalMaterial color={CAR_COLORS.castIron} roughness={0.46} />
          </mesh>
          <mesh castShadow position={[0.018, UPPER_Y - 0.028, 0]}>
            <boxGeometry args={[0.014, 0.028, 0.042]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
          </mesh>
          <mesh castShadow position={[0.018, LOWER_Y - 0.028, 0]}>
            <boxGeometry args={[0.014, 0.028, 0.042]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
          </mesh>
        </group>

        {/* Sliding right crosshead carriage and machined tensile load indicator */}
        <group position={[rightJawX + 0.025, 0.028, 0]}>
          <mesh castShadow position={[0, 0.105, 0]}>
            <boxGeometry args={[0.026, 0.21, 0.098]} />
            <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
          </mesh>
          <mesh castShadow position={[-0.017, UPPER_Y - 0.028, 0]}>
            <boxGeometry args={[0.014, 0.028, 0.042]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
          </mesh>
          <mesh castShadow position={[-0.017, LOWER_Y - 0.028, 0]}>
            <boxGeometry args={[0.014, 0.028, 0.042]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
          </mesh>
          {/* Brass leadscrew stub and machined red tensile load vector */}
          <group position={[0.014, UPPER_Y - 0.028, 0]}>
            <mesh
              castShadow
              position={[arrowLen / 2, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.0052, 0.0052, arrowLen, 16]} />
              <meshPhysicalMaterial
                clearcoat={0.5}
                color={ORGANIC_COLORS.furnaceRed}
                metalness={0.35}
                roughness={0.28}
              />
            </mesh>
            <mesh
              castShadow
              position={[arrowLen + 0.014, 0, 0]}
              rotation={[0, 0, -Math.PI / 2]}
            >
              <coneGeometry args={[0.015, 0.032, 20]} />
              <meshPhysicalMaterial
                clearcoat={0.55}
                color={ORGANIC_COLORS.furnaceRed}
                metalness={0.35}
                roughness={0.26}
              />
            </mesh>
          </group>
        </group>

        <FormulaPlaque
          formula={isVulcanised ? "(C₅H₈)ₙ · S₂" : "(C₅H₈)ₙ"}
          position={[0, 0.036, 0.118]}
          subtitle={isVulcanised ? "SULFUR CROSSLINKED" : "NATURAL LATEX"}
          width={0.146}
        />

        <LabeledVial
          chemicalName={isVulcanised ? "Sulfur Agent" : "Isoprene Latex"}
          concentration={isVulcanised ? "2% w/w" : "Natural"}
          fillHeight={0.044}
          formula={isVulcanised ? "S₈" : "C₅H₈"}
          liquidColor={
            isVulcanised ? PROCESS_COLORS.sulfurYellow : REAGENT_COLORS.solution
          }
          position={[-0.362, 0, 0.025]}
          stripeColor={
            isVulcanised
              ? BENCH_COLORS.bottleStripeVinegar
              : BENCH_COLORS.bottleStripeSalt
          }
        />
      </group>
    </group>
  );
}

function IsopreneChainBead({
  highlight,
  index,
  isReactive,
  nextPoint,
  point,
}: {
  readonly highlight: boolean;
  readonly index: number;
  readonly isReactive: boolean;
  readonly nextPoint: readonly [number, number, number];
  readonly point: readonly [number, number, number];
}) {
  if (index === 0 || index === 14) {
    return null;
  }
  const methylDir = index % 2 === 0 ? 0.016 : -0.016;
  const methylTip = [point[0], point[1] + methylDir, point[2] + 0.01] as const;

  return (
    <group>
      <AtomSphere
        color={
          highlight ? ORGANIC_COLORS.doubleBondGold : ORGANIC_COLORS.carbonDark
        }
        emissive={highlight ? ORGANIC_COLORS.doubleBondGold : undefined}
        emissiveIntensity={highlight ? 0.45 : 0}
        position={point}
        radius={isReactive ? 0.0086 : 0.0072}
      />
      {highlight ? (
        <MultiBond
          color={ORGANIC_COLORS.doubleBondGold}
          emissive={ORGANIC_COLORS.doubleBondGold}
          emissiveIntensity={0.42}
          end={nextPoint}
          gap={0.0056}
          order={2}
          radius={0.0028}
          start={point}
        />
      ) : null}
      {index % 3 === 1 ? (
        <group>
          <BondCylinder end={methylTip} radius={0.002} start={point} />
          <AtomSphere
            color={ORGANIC_COLORS.isopreneEmerald}
            position={methylTip}
            radius={0.0056}
          />
        </group>
      ) : null}
    </group>
  );
}

/** Sculpted wavy cis-1,4-polyisoprene polymer chain with carbon beads and methyl side groups. */
export function PolyisopreneChain({
  showDoubleBonds,
  spanHalf,
  waveAmp,
  xOffset,
  yCenter,
}: {
  readonly showDoubleBonds: boolean;
  readonly spanHalf: number;
  readonly waveAmp: number;
  readonly xOffset: number;
  readonly yCenter: number;
}) {
  const points = useMemo(
    () =>
      Arr.map(CHAIN_SAMPLES, (idx) => {
        const isReactive = idx === 3 || idx === 7 || idx === 11;
        return {
          highlight: showDoubleBonds && isReactive,
          id: `iso-${idx}`,
          index: idx,
          isReactive,
          pos: chainPointAt(idx, xOffset, yCenter, spanHalf, waveAmp),
        };
      }),
    [showDoubleBonds, spanHalf, waveAmp, xOffset, yCenter]
  );

  const tubeGeo = useMemo(() => {
    const curve = new CatmullRomCurve3(
      Arr.map(points, ({ pos }) => new Vector3(pos[0], pos[1], pos[2]))
    );
    return new TubeGeometry(curve, 64, 0.0052, 14, false);
  }, [points]);
  useEffect(() => () => tubeGeo.dispose(), [tubeGeo]);

  return (
    <group>
      <mesh castShadow geometry={tubeGeo}>
        <meshPhysicalMaterial
          clearcoat={0.7}
          clearcoatRoughness={0.16}
          color={ORGANIC_COLORS.isopreneEmerald}
          roughness={0.28}
        />
      </mesh>
      {Arr.map(points, (item) => (
        <IsopreneChainBead
          highlight={item.highlight}
          index={item.index}
          isReactive={item.isReactive}
          key={item.id}
          nextPoint={points[item.index + 1]?.pos ?? item.pos}
          point={item.pos}
        />
      ))}
    </group>
  );
}

/** Zig-zag 3D -S-S- disulfide crosslink bridges locking adjacent polyisoprene chains together. */
export function DisulfideBridges({
  lowerOffset,
  spanHalf,
  upperOffset,
  waveAmp,
}: {
  readonly lowerOffset: number;
  readonly spanHalf: number;
  readonly upperOffset: number;
  readonly waveAmp: number;
}) {
  return (
    <group>
      {Arr.map(CROSSLINK_INDICES, (idx) => {
        const top = chainPointAt(idx, upperOffset, UPPER_Y, spanHalf, waveAmp);
        const bot = chainPointAt(idx, lowerOffset, LOWER_Y, spanHalf, waveAmp);
        const s1 = [
          top[0] * 0.65 + bot[0] * 0.35 - 0.01,
          top[1] * 0.66 + bot[1] * 0.34,
          0.009,
        ] as const;
        const s2 = [
          top[0] * 0.35 + bot[0] * 0.65 + 0.01,
          top[1] * 0.34 + bot[1] * 0.66,
          -0.009,
        ] as const;

        return (
          <group key={`ss-${idx}`}>
            <BondCylinder
              color={ORGANIC_COLORS.sulfurBridge}
              end={s1}
              radius={0.0034}
              start={top}
            />
            <BondCylinder
              color={ORGANIC_COLORS.sulfurBridge}
              emissive={ORGANIC_COLORS.sulfurBridge}
              emissiveIntensity={0.28}
              end={s2}
              radius={0.0038}
              start={s1}
            />
            <BondCylinder
              color={ORGANIC_COLORS.sulfurBridge}
              end={bot}
              radius={0.0034}
              start={s2}
            />
            <AtomSphere
              color={ORGANIC_COLORS.sulfurBridge}
              emissive={ORGANIC_COLORS.sulfurBridge}
              emissiveIntensity={0.26}
              position={s1}
              radius={0.0102}
            />
            <AtomSphere
              color={ORGANIC_COLORS.sulfurBridge}
              emissive={ORGANIC_COLORS.sulfurBridge}
              emissiveIntensity={0.26}
              position={s2}
              radius={0.0102}
            />
          </group>
        );
      })}
    </group>
  );
}
