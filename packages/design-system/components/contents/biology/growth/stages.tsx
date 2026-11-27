import type { PlantLifeCycle } from "@repo/design-system/components/contents/biology/growth/model";
import {
  BotanicalLeaf,
  createSoilTexture,
  FibrousRoots,
} from "@repo/design-system/components/contents/biology/seedling";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, SphereGeometry, Vector3 } from "three";

const PETALS = Arr.range(0, 9);

const LEAF_TIERS = [
  { id: "t1", pitch: 0.25, ratio: 0.28, scale: 0.85, yaw: 0.3 },
  { id: "t2", pitch: 0.28, ratio: 0.42, scale: 0.96, yaw: 2.4 },
  { id: "t3", pitch: 0.22, ratio: 0.56, scale: 1.0, yaw: 4.5 },
  { id: "t4", pitch: 0.3, ratio: 0.7, scale: 0.88, yaw: 1.1 },
  { id: "t5", pitch: 0.32, ratio: 0.84, scale: 0.72, yaw: 3.6 },
  { id: "t6", pitch: 0.36, ratio: 0.92, scale: 0.58, yaw: 5.5 },
] as const;

/** Natural cedar-framed soil bed with sculpted granular humus mound. */
export function SoilPlanterBed() {
  const soilTex = useMemo(() => createSoilTexture(), []);
  useEffect(() => () => soilTex?.dispose(), [soilTex]);

  const moundGeo = useMemo(() => {
    const mound = new SphereGeometry(
      0.56,
      36,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.48
    );
    const pos = mound.getAttribute("position");
    for (let i = 0; i < pos.count; i += 1) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const bump = 1 + (hashUnit(i, 5) - 0.5) * 0.1;
      pos.setXYZ(i, vx, vy * 0.24 * bump, vz);
    }
    mound.computeVertexNormals();
    return mound;
  }, []);
  useEffect(() => () => moundGeo.dispose(), [moundGeo]);

  return (
    <group>
      {/* Cedar timber planter ring */}
      <mesh castShadow position={[0, 0.12, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.56, 0.24, 36]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.cedarDark}
          roughness={0.84}
        />
      </mesh>
      <mesh
        castShadow
        position={[0, 0.24, 0]}
        receiveShadow
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.6, 0.032, 12, 40]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.cedarLight}
          roughness={0.78}
        />
      </mesh>
      {/* Granular moist peat mound */}
      <mesh geometry={moundGeo} position={[0, 0.21, 0]} receiveShadow>
        <meshStandardMaterial
          bumpMap={soilTex}
          bumpScale={0.025}
          color={BOTANY_COLORS.soilDark}
          map={soilTex}
          roughness={0.95}
        />
      </mesh>
    </group>
  );
}

/** Multi-petal botanical flower blossom crowning a mature annual or biennial plant. */
function BotanicalBlossom({
  position,
  scale,
}: {
  readonly position: readonly [number, number, number];
  readonly scale: number;
}) {
  return (
    <group position={position} scale={scale}>
      {/* Central dark disk florets */}
      <mesh castShadow>
        <sphereGeometry args={[0.068, 18, 12]} />
        <meshStandardMaterial
          color={FOLIAGE_COLORS.flowerCenter}
          roughness={0.76}
        />
      </mesh>
      {/* Ring of ray petals */}
      {Arr.map(PETALS, (idx) => {
        const ang = (idx / PETALS.length) * Math.PI * 2;
        return (
          <group
            key={idx}
            position={[Math.cos(ang) * 0.06, 0.01, Math.sin(ang) * 0.06]}
            rotation={[0.25, -ang, 0.2]}
          >
            <BotanicalLeaf
              baseColor={FOLIAGE_COLORS.flowerAccent}
              droop={0.18}
              length={0.16}
              veinColor={BOTANY_COLORS.cotyledonGold}
              width={0.48}
            />
          </group>
        );
      })}
    </group>
  );
}

/** Sculpted plant specimen morphing smoothly from germinating seed to leafy/flowering or woody crown. */
export function GrowthPlantSpecimen({
  dryMass,
  hasFlower,
  isSenescent,
  lifeCycle,
}: {
  readonly dryMass: number;
  readonly hasFlower: boolean;
  readonly isSenescent: boolean;
  readonly lifeCycle: PlantLifeCycle;
}) {
  const stemHeight = 0.18 + dryMass * 1.12;
  const stemRadius =
    lifeCycle === "perennial"
      ? 0.036 + dryMass * 0.044
      : 0.022 + dryMass * 0.022;

  const stemCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(0.02, stemHeight * 0.35, 0.01),
        new Vector3(-0.018, stemHeight * 0.72, -0.01),
        new Vector3(0.005, stemHeight, 0),
      ]),
    [stemHeight]
  );

  const leafBase = isSenescent
    ? FOLIAGE_COLORS.senescentLeaf
    : BOTANY_COLORS.healthyLeafDeep;
  const leafVein = isSenescent
    ? BOTANY_COLORS.cotyledonGold
    : BOTANY_COLORS.healthyLeafVein;

  return (
    <group position={[0, 0.24, 0]}>
      {/* Germinating seed coat and radicle visible during lag phase */}
      {dryMass < 0.26 ? (
        <group position={[0.04, 0.02, 0.06]}>
          <mesh castShadow rotation={[0.3, 0.4, 0.5]} scale={[1.35, 0.85, 0.9]}>
            <sphereGeometry args={[0.055, 18, 14]} />
            <meshStandardMaterial
              color={BOTANY_COLORS.testaBrown}
              roughness={0.68}
            />
          </mesh>
          <FibrousRoots
            color={BOTANY_COLORS.rootIvory}
            count={4}
            depth={0.12}
            position={[0, -0.01, 0]}
            seed={3}
            spread={0.08}
          />
        </group>
      ) : null}

      {/* Curved living stem or woody perennial trunk */}
      <mesh castShadow>
        <tubeGeometry args={[stemCurve, 28, stemRadius, 12, false]} />
        <meshStandardMaterial
          color={
            lifeCycle === "perennial"
              ? FOLIAGE_COLORS.stemWood
              : FOLIAGE_COLORS.collenchymaWall
          }
          roughness={lifeCycle === "perennial" ? 0.84 : 0.6}
        />
      </mesh>

      {/* Unfolding cotyledons near seedling base */}
      {Arr.map([-1, 1] as const, (side) => (
        <BotanicalLeaf
          baseColor={BOTANY_COLORS.windGreen}
          droop={0.12}
          key={`cot-${side}`}
          length={0.14 + Math.min(0.08, dryMass * 0.14)}
          position={[0, Math.min(0.16, stemHeight * 0.35), 0]}
          rotation={[0, side === 1 ? 0.2 : Math.PI - 0.2, 0.35]}
          veinColor={BOTANY_COLORS.healthyLeafVein}
          width={0.62}
        />
      ))}

      {/* True veined botanical leaves emerging up the stem */}
      {Arr.map(LEAF_TIERS, (node, idx) => {
        const threshold = 0.06 + idx * 0.08;
        if (dryMass < threshold) {
          return null;
        }
        const pt = stemCurve.getPoint(node.ratio);
        const leafLen =
          (0.26 + Math.min(1, (dryMass - threshold) * 1.9) * 0.28) * node.scale;
        return (
          <BotanicalLeaf
            baseColor={leafBase}
            droop={isSenescent ? 0.42 : 0.22}
            edgeColor={isSenescent ? BOTANY_COLORS.necrosisEdge : undefined}
            key={node.id}
            length={leafLen}
            position={[pt.x, pt.y, pt.z]}
            rotation={[0.24, node.yaw, isSenescent ? -0.35 : node.pitch]}
            veinColor={leafVein}
            width={0.62}
          />
        );
      })}

      {/* Perennial woody branching crown with layered veined foliage */}
      {lifeCycle === "perennial" && dryMass > 0.35 ? (
        <group position={[0, stemHeight * 0.88, 0]}>
          {Arr.map(Arr.range(0, 7), (idx) => {
            const ang = (idx / 8) * Math.PI * 2;
            const len = 0.24 + dryMass * 0.28;
            return (
              <BotanicalLeaf
                baseColor={BOTANY_COLORS.healthyLeafDeep}
                droop={0.22}
                key={`cr-${idx}`}
                length={len}
                position={[0, 0.06 + (idx % 3) * 0.07, 0]}
                rotation={[0, ang, 0.42 - (idx % 3) * 0.14]}
                veinColor={BOTANY_COLORS.healthyLeafVein}
                width={0.62}
              />
            );
          })}
        </group>
      ) : null}

      {/* Mature flower blossom */}
      {hasFlower ? (
        <BotanicalBlossom
          position={[0.005, stemHeight + 0.04, 0]}
          scale={0.75 + dryMass * 0.45}
        />
      ) : null}
    </group>
  );
}
