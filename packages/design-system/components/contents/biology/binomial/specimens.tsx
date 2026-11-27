import type { GardenPlant } from "@repo/design-system/components/contents/biology/binomial/model";
import {
  BotanicalLeaf,
  createSoilTexture,
} from "@repo/design-system/components/contents/biology/seedling";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";

const VINE_ANCHORS = [
  { id: "v1", pitch: 0.28, x: -0.14, yaw: 2.6, z: 0.06 },
  { id: "v2", pitch: 0.24, x: 0.12, yaw: 0.4, z: -0.06 },
  { id: "v3", pitch: 0.34, x: -0.02, yaw: -1.4, z: -0.14 },
  { id: "v4", pitch: 0.22, x: 0.1, yaw: -0.6, z: 0.12 },
  { id: "v5", pitch: 0.38, x: -0.06, yaw: 1.4, z: 0.02 },
] as const;

const RICE_CULMS = [
  { lean: -0.22, x: -0.14, z: 0.05 },
  { lean: -0.1, x: -0.06, z: -0.06 },
  { lean: 0.02, x: 0.02, z: 0.04 },
  { lean: 0.14, x: 0.1, z: -0.05 },
  { lean: 0.24, x: 0.16, z: 0.03 },
] as const;

const NEEM_LEAFLETS = [0.22, 0.4, 0.58, 0.76, 0.92] as const;

/** Realistic museum botanical specimen sculpted for each of the 6 garden taxa (zero toy primitives). */
export function BotanicalSpecimen({ plant }: { readonly plant: GardenPlant }) {
  const { mangoTrunk, neemTrunk, vineStem } = useMemo(
    () => ({
      mangoTrunk: new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(0.015, 0.18, 0.01),
        new Vector3(-0.01, 0.38, -0.01),
      ]),
      neemTrunk: new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(-0.012, 0.22, 0.01),
        new Vector3(0.01, 0.44, 0),
      ]),
      vineStem: new CatmullRomCurve3([
        new Vector3(-0.2, 0.03, 0.08),
        new Vector3(-0.05, 0.08, -0.04),
        new Vector3(0.1, 0.06, 0.06),
        new Vector3(0.22, 0.04, -0.05),
      ]),
    }),
    []
  );

  return Match.value(plant).pipe(
    Match.when("kangkung", () => (
      <group>
        <mesh castShadow>
          <tubeGeometry args={[vineStem, 20, 0.014, 8, false]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.leafFresh}
            roughness={0.55}
          />
        </mesh>
        {Arr.map(VINE_ANCHORS, (a) => (
          <BotanicalLeaf
            baseColor={CLASSIFICATION_COLORS.leafFresh}
            droop={0.18}
            key={a.id}
            length={0.22}
            position={[a.x, 0.06, a.z]}
            rotation={[0, a.yaw, a.pitch]}
            veinColor={BOTANY_COLORS.healthyLeafVein}
            width={0.44}
          />
        ))}
        {/* Morning-glory funnel flower characteristic of Ipomoea */}
        <mesh
          castShadow
          position={[0.04, 0.18, 0.05]}
          rotation={[0.3, 0, -0.2]}
        >
          <cylinderGeometry args={[0.042, 0.012, 0.065, 16, 1, true]} />
          <meshPhysicalMaterial
            clearcoat={0.35}
            color={BOTANY_COLORS.ovuleWhite}
            roughness={0.4}
          />
        </mesh>
      </group>
    )),
    Match.when("sweetPotato", () => (
      <group>
        {/* Sculpted tapered purple storage root tuber half-emerged from soil */}
        <mesh
          castShadow
          position={[0.09, 0.045, 0.08]}
          rotation={[0.1, 0.45, Math.PI / 2 - 0.14]}
          scale={[0.68, 1.5, 0.72]}
        >
          <sphereGeometry args={[0.068, 22, 16]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.tuberPurple}
            roughness={0.76}
          />
        </mesh>
        <mesh castShadow>
          <tubeGeometry args={[vineStem, 20, 0.012, 8, false]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.leafBright}
            roughness={0.58}
          />
        </mesh>
        {Arr.map(VINE_ANCHORS, (a) => (
          <BotanicalLeaf
            baseColor={CLASSIFICATION_COLORS.leafBright}
            droop={0.22}
            key={a.id}
            length={0.2}
            position={[a.x, 0.08, a.z]}
            rotation={[0, a.yaw, a.pitch]}
            veinColor={BOTANY_COLORS.healthyLeafVein}
            width={0.74}
          />
        ))}
      </group>
    )),
    Match.when("mango", () => (
      <group>
        <mesh castShadow>
          <tubeGeometry args={[mangoTrunk, 16, 0.028, 10, false]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.barkBrown}
            roughness={0.86}
          />
        </mesh>
        {/* Drooping lance-shaped mango leaf rosettes */}
        {Arr.map(Arr.range(0, 7), (idx) => {
          const ang = (idx / 8) * Math.PI * 2;
          return (
            <BotanicalLeaf
              baseColor={CLASSIFICATION_COLORS.leafDeep}
              droop={0.3}
              key={`mg-${idx}`}
              length={0.24}
              position={[0, 0.36 + (idx % 3) * 0.04, 0]}
              rotation={[0, ang, 0.28 - (idx % 2) * 0.25]}
              veinColor={BOTANY_COLORS.healthyLeafVein}
              width={0.4}
            />
          );
        })}
        {/* Hanging sculpted ripening mango fruit */}
        <mesh
          castShadow
          position={[0.11, 0.26, 0.08]}
          rotation={[0.15, 0.2, -0.22]}
          scale={[0.78, 1.18, 0.85]}
        >
          <sphereGeometry args={[0.048, 20, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.45}
            color={CLASSIFICATION_COLORS.mangoFruit}
            roughness={0.34}
          />
        </mesh>
      </group>
    )),
    Match.when("beluntas", () => (
      <group>
        {Arr.map(Arr.range(0, 4), (s) => {
          const ang = (s / 5) * Math.PI * 2;
          const curve = new CatmullRomCurve3([
            new Vector3(0, 0, 0),
            new Vector3(Math.cos(ang) * 0.08, 0.14, Math.sin(ang) * 0.08),
            new Vector3(Math.cos(ang) * 0.14, 0.28, Math.sin(ang) * 0.14),
          ]);
          const tip = curve.getPoint(1);
          return (
            <group key={`bl-${s}`}>
              <mesh castShadow>
                <tubeGeometry args={[curve, 10, 0.011, 6, false]} />
                <meshStandardMaterial
                  color={BOTANY_COLORS.barkBrown}
                  roughness={0.82}
                />
              </mesh>
              <BotanicalLeaf
                baseColor={CLASSIFICATION_COLORS.leafBright}
                droop={0.2}
                length={0.18}
                position={[tip.x * 0.6, tip.y * 0.65, tip.z * 0.6]}
                rotation={[0, ang + 0.5, 0.3]}
                veinColor={BOTANY_COLORS.healthyLeafVein}
                width={0.62}
              />
              <BotanicalLeaf
                baseColor={CLASSIFICATION_COLORS.leafFresh}
                droop={0.18}
                length={0.16}
                position={[tip.x, tip.y, tip.z]}
                rotation={[0, ang - 0.4, 0.2]}
                veinColor={BOTANY_COLORS.healthyLeafVein}
                width={0.6}
              />
              {/* Violet Asteraceae composite floret head */}
              <mesh castShadow position={[tip.x, tip.y + 0.035, tip.z]}>
                <sphereGeometry args={[0.026, 12, 10]} />
                <meshStandardMaterial
                  color={CLASSIFICATION_COLORS.flowerViolet}
                  roughness={0.5}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    )),
    Match.when("neem", () => (
      <group>
        <mesh castShadow>
          <tubeGeometry args={[neemTrunk, 16, 0.022, 10, false]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.barkBrown}
            roughness={0.86}
          />
        </mesh>
        {/* Compound pinnate neem fronds radiating from the crown */}
        {Arr.map(Arr.range(0, 4), (f) => {
          const yaw = (f / 5) * Math.PI * 2 + 0.3;
          return (
            <group
              key={`nf-${f}`}
              position={[0, 0.38 + (f % 2) * 0.05, 0]}
              rotation={[0, yaw, 0.18]}
            >
              <mesh position={[0.14, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.004, 0.006, 0.28, 6]} />
                <meshStandardMaterial
                  color={BOTANY_COLORS.stemGreen}
                  roughness={0.62}
                />
              </mesh>
              {Arr.map(NEEM_LEAFLETS, (frac) =>
                Arr.map([-1, 1] as const, (side) => (
                  <BotanicalLeaf
                    baseColor={CLASSIFICATION_COLORS.leafDeep}
                    droop={0.14}
                    key={`${frac}-${side}`}
                    length={0.11}
                    position={[frac * 0.26, 0, 0]}
                    rotation={[0, side * 1.15, 0.12]}
                    veinColor={BOTANY_COLORS.healthyLeafVein}
                    width={0.38}
                  />
                ))
              )}
            </group>
          );
        })}
      </group>
    )),
    Match.when("padi", () => (
      <group>
        {Arr.map(RICE_CULMS, (culm, idx) => {
          const curve = new CatmullRomCurve3([
            new Vector3(culm.x * 0.5, 0, culm.z * 0.5),
            new Vector3(culm.x, 0.22, culm.z),
            new Vector3(culm.x + culm.lean * 0.5, 0.4, culm.z),
            new Vector3(culm.x + culm.lean * 0.95, 0.36, culm.z + 0.03),
          ]);
          const tip = curve.getPoint(0.95);
          return (
            <group key={`rc-${culm.x}-${culm.z}`}>
              <mesh castShadow>
                <tubeGeometry args={[curve, 16, 0.007, 6, false]} />
                <meshStandardMaterial
                  color={CLASSIFICATION_COLORS.leafBright}
                  roughness={0.6}
                />
              </mesh>
              {/* Drooping golden grain-beaded rice panicle */}
              {Arr.map(Arr.range(0, 4), (g) => {
                const pt = curve.getPoint(0.68 + g * 0.075);
                return (
                  <mesh
                    castShadow
                    key={`gr-${g}`}
                    position={[pt.x, pt.y - 0.01, pt.z]}
                    rotation={[0.2, idx, 0.6]}
                    scale={[0.7, 1.5, 0.7]}
                  >
                    <sphereGeometry args={[0.015, 8, 6]} />
                    <meshStandardMaterial
                      color={CLASSIFICATION_COLORS.padiGold}
                      roughness={0.52}
                    />
                  </mesh>
                );
              })}
              {/* Arching linear rice grass leaf */}
              <BotanicalLeaf
                baseColor={CLASSIFICATION_COLORS.padiLeaf}
                droop={0.34}
                length={0.24}
                position={[culm.x, 0.16, culm.z]}
                rotation={[0, idx * 1.2, 0.45]}
                veinColor={BOTANY_COLORS.healthyLeafVein}
                width={0.18}
              />
              <mesh position={[tip.x, tip.y - 0.02, tip.z]}>
                <sphereGeometry args={[0.012, 6, 6]} />
                <meshStandardMaterial
                  color={CLASSIFICATION_COLORS.padiHusk}
                  roughness={0.55}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    )),
    Match.exhaustive
  );
}

/** Carved cedar museum botanical display plinth with soil tray and beveled brass corner frame. */
export function CedarDisplayPlinth({
  highlightColor,
  isMatched,
}: {
  readonly highlightColor: string;
  readonly isMatched: boolean;
}) {
  const soilTex = useMemo(() => createSoilTexture(), []);
  useEffect(() => () => soilTex?.dispose(), [soilTex]);

  return (
    <group>
      {/* Stepped cedar hardwood base */}
      <mesh castShadow position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[0.94, 0.08, 0.88]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.cedarDark}
          roughness={0.78}
        />
      </mesh>
      <mesh castShadow position={[0, 0.092, 0]} receiveShadow>
        <boxGeometry args={[0.88, 0.028, 0.82]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.cedarLight}
          roughness={0.72}
        />
      </mesh>
      {/* Organic humus soil bed */}
      <mesh position={[0, 0.105, 0]} receiveShadow>
        <boxGeometry args={[0.8, 0.022, 0.74]} />
        <meshStandardMaterial
          bumpMap={soilTex}
          bumpScale={0.02}
          color={BOTANY_COLORS.soilSubsoil}
          map={soilTex}
          roughness={0.94}
        />
      </mesh>
      {/* Subtle taxonomic match indicator border */}
      {isMatched ? (
        <mesh position={[0, 0.118, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.33, 0.375, 40]} />
          <meshStandardMaterial
            color={highlightColor}
            emissive={highlightColor}
            emissiveIntensity={0.35}
            roughness={0.3}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/** Field botanist's brass-rimmed magnifying loupe resting beside the active specimen. */
export function BotanicalLoupe({
  position,
}: {
  readonly position: readonly [number, number, number];
}) {
  return (
    <group position={position} rotation={[0.25, -0.45, 0.12]}>
      <mesh castShadow>
        <torusGeometry args={[0.085, 0.012, 12, 32]} />
        <MetalMaterial color={BOTANY_COLORS.brassGold} roughness={0.28} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.08, 0.08, 0.01, 28]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.34} />
      </mesh>
      <mesh
        castShadow
        position={[0.135, -0.02, 0]}
        rotation={[0, 0, Math.PI / 2 - 0.12]}
      >
        <cylinderGeometry args={[0.013, 0.016, 0.13, 14]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.cedarDark}
          roughness={0.68}
        />
      </mesh>
    </group>
  );
}
