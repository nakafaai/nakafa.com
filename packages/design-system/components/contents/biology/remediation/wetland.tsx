import {
  BotanicalLeaf,
  createSoilTexture,
  FibrousRoots,
} from "@repo/design-system/components/contents/biology/botanical";
import { useGrassClump } from "@repo/design-system/components/contents/biology/flora";
import type { RemediationPlant } from "@repo/design-system/components/contents/biology/remediation/model";
import {
  useGround,
  useHorizonFade,
} from "@repo/design-system/components/three/stage/terrain";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";

const MUSTARD_LEAVES = [
  { id: "ml1", pitch: 0.25, roll: 0.34, y: 0.48, yaw: 0.2 },
  { id: "ml2", pitch: 0.28, roll: 0.32, y: 0.54, yaw: 1.45 },
  { id: "ml3", pitch: 0.22, roll: 0.3, y: 0.62, yaw: 2.85 },
  { id: "ml4", pitch: 0.32, roll: 0.34, y: 0.72, yaw: 4.15 },
  { id: "ml5", pitch: 0.28, roll: 0.3, y: 0.82, yaw: 5.3 },
  { id: "ml6", pitch: 0.36, roll: 0.28, y: 0.9, yaw: 0.85 },
] as const;

const HYACINTH_LEAVES = [
  { id: "hl1", yaw: 0.2 },
  { id: "hl2", yaw: 1.45 },
  { id: "hl3", yaw: 2.75 },
  { id: "hl4", yaw: 4.05 },
  { id: "hl5", yaw: 5.3 },
] as const;

/** Seamless natural outdoor soil/wetland terrain fading smoothly into the horizon. */
export function WetlandHorizonFloor({
  isAquatic,
}: {
  readonly isAquatic: boolean;
}) {
  const texture = useGround(isAquatic ? "sand" : "soil", [22, 22]);
  const horizonFade = useHorizonFade(2.2, 11.5);

  return (
    <mesh
      position={[0, 0, 0]}
      receiveShadow
      renderOrder={-10}
      rotation={[-Math.PI / 2, 0, 0]}
      userData={{ treatAsOpaque: true }}
    >
      <circleGeometry args={[15, 96]} />
      <meshStandardMaterial
        aoMap={texture.patches}
        aoMapIntensity={0.85}
        bumpMap={texture.bump}
        bumpScale={0.22}
        depthWrite
        map={texture.map}
        ref={horizonFade}
        roughness={0.92}
        transparent
      />
    </mesh>
  );
}

/** Layered geological soil horizons OR translucent wetland aquatic cutaway trough. */
export function SubstrateCutaway({
  isAquatic,
}: {
  readonly isAquatic: boolean;
}) {
  const soilTex = useMemo(() => createSoilTexture(), []);
  useEffect(() => () => soilTex?.dispose(), [soilTex]);

  if (isAquatic) {
    return (
      <group>
        {/* Submerged river silt bed */}
        <mesh position={[0, 0.055, 0]} receiveShadow>
          <boxGeometry args={[2.16, 0.11, 0.94]} />
          <meshStandardMaterial
            bumpMap={soilTex}
            bumpScale={0.02}
            color={BOTANY_COLORS.humusDark}
            map={soilTex}
            roughness={0.95}
          />
        </mesh>
        {/* Translucent wetland groundwater body */}
        <mesh position={[0, 0.25, 0]} receiveShadow>
          <boxGeometry args={[2.12, 0.29, 0.9]} />
          <meshPhysicalMaterial
            clearcoat={0.95}
            clearcoatRoughness={0.08}
            color={BOTANY_COLORS.groundwaterTeal}
            ior={1.333}
            opacity={0.56}
            roughness={0.1}
            transparent
          />
        </mesh>
        {/* Timber retaining bank strips along rear and sides */}
        <mesh castShadow position={[0, 0.22, -0.46]} receiveShadow>
          <boxGeometry args={[2.22, 0.44, 0.05]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.cedarDark}
            roughness={0.86}
          />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      {/* Bedrock & gravel base horizon (C-horizon) */}
      <mesh position={[0, 0.06, -0.04]} receiveShadow>
        <boxGeometry args={[2.14, 0.12, 0.86]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.gravelSlate}
          roughness={0.92}
        />
      </mesh>
      {/* Ochre mineral clay subsoil (B-horizon) */}
      <mesh position={[0, 0.19, -0.04]} receiveShadow>
        <boxGeometry args={[2.14, 0.14, 0.86]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.soilSubsoil}
          roughness={0.9}
        />
      </mesh>
      {/* Organic humus topsoil (A-horizon) */}
      <mesh position={[0, 0.33, -0.04]} receiveShadow>
        <boxGeometry args={[2.14, 0.14, 0.86]} />
        <meshStandardMaterial
          bumpMap={soilTex}
          bumpScale={0.025}
          color={BOTANY_COLORS.soilDark}
          map={soilTex}
          roughness={0.95}
        />
      </mesh>
      {/* Front rhizotron cutaway window exposing dense fibrous roots in the soil profile */}
      <FibrousRoots
        color={BOTANY_COLORS.rootIvory}
        count={12}
        depth={0.32}
        position={[0, 0.38, 0.4]}
        seed={43}
        spread={0.44}
      />
    </group>
  );
}

/** Species-accurate hyperaccumulator plant: Indian mustard, water hyacinth, or vetiver grass. */
export function HyperaccumulatorPlant({
  plant,
}: {
  readonly plant: RemediationPlant;
}) {
  const vetiverClump = useGrassClump(31, 22);
  const stemCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0.4, 0),
        new Vector3(0.02, 0.68, 0.01),
        new Vector3(-0.015, 0.96, 0),
      ]),
    []
  );

  return Match.value(plant).pipe(
    Match.when("mustard", () => (
      <group>
        <FibrousRoots
          color={BOTANY_COLORS.rootIvory}
          count={12}
          depth={0.34}
          position={[0, 0.39, 0]}
          seed={41}
          spread={0.42}
        />
        <mesh castShadow>
          <tubeGeometry args={[stemCurve, 20, 0.026, 10, false]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.stemGreen}
            roughness={0.58}
          />
        </mesh>
        {Arr.map(MUSTARD_LEAVES, (lf) => (
          <BotanicalLeaf
            baseColor={BOTANY_COLORS.healthyLeafDeep}
            droop={0.22}
            key={lf.id}
            length={0.42}
            position={[0, lf.y, 0]}
            rotation={[lf.roll, lf.yaw, lf.pitch]}
            veinColor={BOTANY_COLORS.healthyLeafVein}
            width={0.64}
          />
        ))}
        {/* Yellow four-petal brassica raceme blossoms at apex */}
        {Arr.map(Arr.range(0, 5), (idx) => {
          const ang = (idx / 6) * Math.PI * 2;
          return (
            <group
              key={`fl-${idx}`}
              position={[
                Math.cos(ang) * 0.068,
                0.96 + (idx % 3) * 0.042,
                Math.sin(ang) * 0.068,
              ]}
              rotation={[0.3, -ang, 0.25]}
            >
              <BotanicalLeaf
                baseColor={BOTANY_COLORS.chlorosisYellow}
                droop={0.14}
                length={0.11}
                veinColor={BOTANY_COLORS.cotyledonGold}
                width={0.62}
              />
            </group>
          );
        })}
      </group>
    )),
    Match.when("hyacinth", () => (
      <group>
        {/* Dense dangling feathered purple-tinted aquatic root curtain */}
        <FibrousRoots
          color={BOTANY_COLORS.hyacinthRoot}
          count={16}
          depth={0.34}
          position={[0, 0.39, 0]}
          seed={52}
          spread={0.38}
        />
        {/* Floating inflated spongy petioles + glossy rounded leaves */}
        {Arr.map(HYACINTH_LEAVES, (lf) => (
          <group key={lf.id} rotation={[0, lf.yaw, 0]}>
            <mesh
              castShadow
              position={[0.09, 0.46, 0]}
              scale={[1.25, 0.85, 0.9]}
            >
              <sphereGeometry args={[0.068, 16, 12]} />
              <meshPhysicalMaterial
                clearcoat={0.45}
                color={BOTANY_COLORS.hyacinthPetiole}
                roughness={0.38}
              />
            </mesh>
            <BotanicalLeaf
              baseColor={BOTANY_COLORS.healthyLeafDeep}
              droop={0.16}
              length={0.38}
              position={[0.12, 0.52, 0]}
              rotation={[0, 0, 0.42]}
              veinColor={BOTANY_COLORS.healthyLeafVein}
              width={0.78}
            />
          </group>
        ))}
        {/* Lavender water-hyacinth flower spike */}
        {Arr.map(Arr.range(0, 5), (idx) => {
          const ang = (idx / 6) * Math.PI * 2;
          return (
            <mesh
              castShadow
              key={`hp-${idx}`}
              position={[
                Math.cos(ang) * 0.055,
                0.76 + (idx % 3) * 0.05,
                Math.sin(ang) * 0.055,
              ]}
            >
              <sphereGeometry args={[0.044, 14, 10]} />
              <meshPhysicalMaterial
                clearcoat={0.35}
                color={BOTANY_COLORS.hyacinthPetal}
                roughness={0.42}
              />
            </mesh>
          );
        })}
      </group>
    )),
    Match.when("vetiver", () => (
      <group>
        {/* Deep vertical fibrous vetiver root mat */}
        <FibrousRoots
          color={BOTANY_COLORS.rootTipCream}
          count={16}
          depth={0.36}
          position={[0, 0.39, 0]}
          seed={63}
          spread={0.32}
        />
        <mesh
          castShadow
          geometry={vetiverClump}
          position={[0, 0.39, 0]}
          scale={[2.2, 2.7, 2.2]}
        >
          <meshPhysicalMaterial
            clearcoat={0.22}
            color={FOLIAGE_COLORS.palisade}
            roughness={0.5}
            vertexColors
          />
        </mesh>
      </group>
    )),
    Match.exhaustive
  );
}
