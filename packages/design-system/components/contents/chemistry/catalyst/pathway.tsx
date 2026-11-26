import {
  archY,
  RAIL_Z_OFFSET,
  RIG_Z,
  trackX,
} from "@repo/design-system/components/contents/chemistry/catalyst/frame";
import type { CatalystState } from "@repo/design-system/components/contents/chemistry/catalyst/model";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { KINETICS_COLORS } from "@repo/design-system/lib/material/kinetics";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

const SITE_COLS = Arr.range(0, 4);
const SITE_ROWS = Arr.range(0, 2);

/** Builds a smooth continuous TubeGeometry energy profile from 41 sampled points. */
function buildPathwayTube(
  startY: number,
  peakY: number,
  endY: number,
  z: number,
  radius: number
): TubeGeometry {
  const points = Arr.makeBy(41, (index) => {
    const t = index / 40;
    return new Vector3(trackX(t), archY(t, startY, peakY, endY), z);
  });
  const curve = new CatmullRomCurve3(points);
  return new TubeGeometry(curve, 72, radius, 16, false);
}

/** Continuous smooth TubeGeometry energy rails and activation barrier indicator. */
export function PathwayRails({
  catalysedPeakY,
  catalyst,
  productY,
  reactantY,
  uncatalysedPeakY,
}: {
  readonly catalysedPeakY: number;
  readonly catalyst: CatalystState;
  readonly productY: number;
  readonly reactantY: number;
  readonly uncatalysedPeakY: number;
}) {
  const isPresent = catalyst === "present";

  const uncatalysedGeo = useMemo(
    () =>
      buildPathwayTube(
        reactantY,
        uncatalysedPeakY,
        productY,
        RIG_Z - RAIL_Z_OFFSET,
        isPresent ? 0.0048 : 0.0076
      ),
    [isPresent, productY, reactantY, uncatalysedPeakY]
  );

  const catalysedGeo = useMemo(
    () =>
      buildPathwayTube(
        reactantY,
        catalysedPeakY,
        productY,
        RIG_Z + RAIL_Z_OFFSET,
        isPresent ? 0.0078 : 0.0046
      ),
    [catalysedPeakY, isPresent, productY, reactantY]
  );

  useEffect(
    () => () => {
      uncatalysedGeo.dispose();
      catalysedGeo.dispose();
    },
    [catalysedGeo, uncatalysedGeo]
  );

  const activePeakY = isPresent ? catalysedPeakY : uncatalysedPeakY;
  const activeZ = isPresent ? RIG_Z + RAIL_Z_OFFSET : RIG_Z - RAIL_Z_OFFSET;
  const barrierHeight = Math.max(0.01, activePeakY - reactantY);

  return (
    <group>
      <mesh castShadow={!isPresent} geometry={uncatalysedGeo}>
        <meshPhysicalMaterial
          clearcoat={0.9}
          clearcoatRoughness={0.1}
          color={KINETICS_COLORS.uncatalysedPath}
          emissive={KINETICS_COLORS.uncatalysedPath}
          emissiveIntensity={isPresent ? 0.08 : 0.55}
          opacity={isPresent ? 0.3 : 1}
          roughness={isPresent ? 0.12 : 0.22}
          transparent={isPresent}
        />
      </mesh>
      <mesh castShadow={isPresent} geometry={catalysedGeo}>
        <meshPhysicalMaterial
          clearcoat={0.9}
          clearcoatRoughness={0.1}
          color={KINETICS_COLORS.catalysedPath}
          emissive={KINETICS_COLORS.catalysedPath}
          emissiveIntensity={isPresent ? 0.6 : 0.06}
          opacity={isPresent ? 1 : 0.28}
          roughness={isPresent ? 0.2 : 0.12}
          transparent={!isPresent}
        />
      </mesh>
      <mesh position={[0, reactantY + barrierHeight / 2, activeZ]}>
        <cylinderGeometry args={[0.0022, 0.0022, barrierHeight, 10]} />
        <meshStandardMaterial
          color={KINETICS_COLORS.activationLine}
          emissive={KINETICS_COLORS.activationLine}
          emissiveIntensity={0.65}
          opacity={0.75}
          transparent
        />
      </mesh>
    </group>
  );
}

/**
 * Porous metallic platinum catalyst surface plate studded with an array of
 * raised hemispherical active-site micro-domes beneath the catalysed crest.
 */
export function CatalystSurfacePlate({
  catalyst,
}: {
  readonly catalyst: CatalystState;
}) {
  const isPresent = catalyst === "present";

  return (
    <group position={[0, isPresent ? 0.036 : 0.029, RIG_Z + RAIL_Z_OFFSET]}>
      <mesh castShadow={isPresent} receiveShadow>
        <boxGeometry args={[0.23, isPresent ? 0.014 : 0.006, 0.082]} />
        <MetalMaterial
          color={
            isPresent
              ? INSTRUMENT_COLORS.platinum
              : KINETICS_COLORS.catalystSurface
          }
          roughness={isPresent ? 0.24 : 0.68}
        />
      </mesh>
      {Arr.map(SITE_COLS, (col) =>
        Arr.map(SITE_ROWS, (row) => (
          <mesh
            key={`${col}-${row}`}
            position={[
              -0.08 + col * 0.04,
              isPresent ? 0.007 : 0.003,
              -0.022 + row * 0.022,
            ]}
          >
            <sphereGeometry
              args={[
                isPresent ? 0.0072 : 0.0045,
                14,
                10,
                0,
                Math.PI * 2,
                0,
                Math.PI / 2,
              ]}
            />
            <meshStandardMaterial
              color={
                isPresent
                  ? KINETICS_COLORS.catalysedPath
                  : KINETICS_COLORS.catalystSurface
              }
              emissive={
                isPresent ? KINETICS_COLORS.catalysedPath : CAR_COLORS.dashboard
              }
              emissiveIntensity={isPresent ? 0.8 : 0}
              metalness={isPresent ? 0.35 : 0.7}
              roughness={0.28}
            />
          </mesh>
        ))
      )}
    </group>
  );
}
