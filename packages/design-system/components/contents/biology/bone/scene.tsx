import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { prepareAnatomicalScene } from "@repo/design-system/components/contents/biology/anatomy";
import {
  HRA_KNEE_JOINT_ASSET,
  HRA_PELVIS_ASSET,
} from "@repo/design-system/components/contents/biology/assets";
import {
  buildFemurGeometry,
  buildRibGeometry,
  buildTrabeculaCurve,
  TRABECULAR_STRUTS,
} from "@repo/design-system/components/contents/biology/bone/geometry";
import type {
  BoneCondition,
  BonePart,
  HealthState,
} from "@repo/design-system/components/contents/biology/bone/model";
import { focusOf } from "@repo/design-system/components/contents/biology/bone/model";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo } from "react";

const SPINE_LEVELS = [0, 1, 2, 3, 4, 5, 6] as const;
const RIB_PAIRS = [0, 1, 2, 3, 4] as const;
const OSTEON_RINGS = [
  { height: 0.44, opacity: 1, r: 0.17 },
  { height: 0.4, opacity: 0.65, r: 0.125 },
  { height: 0.36, opacity: 0.65, r: 0.08 },
] as const;

function PelvisSkeletonPart({ soft }: { readonly soft: boolean }) {
  const { scene } = useGLTF(HRA_PELVIS_ASSET.path);
  const specimen = useMemo(
    () =>
      prepareAnatomicalScene(scene, {
        fallback: {
          clearcoat: 0.22,
          clearcoatRoughness: 0.48,
          color: soft ? SKELETON_COLORS.boneSoft : SKELETON_COLORS.bone,
          roughness: soft ? 0.65 : 0.48,
        },
        targetExtent: 0.36,
      }),
    [scene, soft]
  );
  return (
    <group position={[0, 0.72, 0]} rotation={[0.1, 0, 0]}>
      <primitive object={specimen} />
    </group>
  );
}

function ArthritisKneeInset({ affected }: { readonly affected: boolean }) {
  const { scene } = useGLTF(HRA_KNEE_JOINT_ASSET.path);
  const specimen = useMemo(
    () =>
      prepareAnatomicalScene(scene, {
        fallback: {
          clearcoat: 0.22,
          color: SKELETON_COLORS.bone,
          roughness: 0.48,
        },
        rules: [
          {
            clearcoat: affected ? 0.15 : 0.8,
            color: affected
              ? SKELETON_COLORS.cartilageWorn
              : SKELETON_COLORS.cartilage,
            match: "cartilage",
            roughness: affected ? 0.75 : 0.2,
          },
          {
            clearcoat: 0.4,
            color: affected
              ? SKELETON_COLORS.membraneInflamed
              : SKELETON_COLORS.disc,
            match: "meniscus",
            roughness: 0.38,
          },
        ],
        targetExtent: 0.68,
      }),
    [affected, scene]
  );
  return (
    <group position={[0, -0.02, 0]} rotation={[0.08, 0.35, 0]}>
      <primitive object={specimen} />
      <mesh position={[0, 0.02, 0.04]} rotation={[Math.PI * 0.48, 0, 0]}>
        <torusGeometry args={[0.24, affected ? 0.036 : 0.018, 14, 36]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={
            affected
              ? SKELETON_COLORS.membraneInflamed
              : SKELETON_COLORS.membraneHealthy
          }
          opacity={affected ? 0.85 : 0.45}
          roughness={0.38}
          transparent
        />
      </mesh>
    </group>
  );
}

function LensContent({
  affected,
  condition,
}: {
  readonly affected: boolean;
  readonly condition: BoneCondition;
}) {
  const healthyStruts = useMemo(
    () => Arr.map(TRABECULAR_STRUTS, (t) => buildTrabeculaCurve(t, 0.03)),
    []
  );
  const porousStruts = useMemo(
    () => Arr.map(TRABECULAR_STRUTS, (t) => buildTrabeculaCurve(t, 0.011)),
    []
  );
  const metaphysisGeo = useMemo(() => buildFemurGeometry(0.46), []);

  useEffect(
    () => () => {
      Arr.forEach(healthyStruts, (geo) => geo.dispose());
      Arr.forEach(porousStruts, (geo) => geo.dispose());
      metaphysisGeo.dispose();
    },
    [healthyStruts, metaphysisGeo, porousStruts]
  );

  const activeStruts = affected
    ? Arr.map(Arr.take(porousStruts, 6), (geo, index) => ({
        geo,
        id: `porous-${Arr.join(Arr.map(TRABECULAR_STRUTS[index][0], String), ",")}`,
      }))
    : Arr.map(healthyStruts, (geo, index) => ({
        geo,
        id: `healthy-${Arr.join(Arr.map(TRABECULAR_STRUTS[index][0], String), ",")}`,
      }));

  return Match.value(condition).pipe(
    Match.when("osteoporosis", () => (
      <group>
        {Arr.map(activeStruts, (item) => (
          <mesh castShadow geometry={item.geo} key={item.id}>
            <meshPhysicalMaterial
              clearcoat={0.22}
              color={
                affected
                  ? SKELETON_COLORS.spongyPorous
                  : SKELETON_COLORS.spongyHealthy
              }
              roughness={affected ? 0.78 : 0.48}
            />
          </mesh>
        ))}
      </group>
    )),
    Match.when("osteomalacia", () => (
      <group rotation={[0, 0, affected ? 0.2 : 0]}>
        {Arr.map(OSTEON_RINGS, (ring) => (
          <mesh castShadow key={ring.r}>
            <cylinderGeometry args={[ring.r, ring.r * 1.03, ring.height, 28]} />
            <meshPhysicalMaterial
              clearcoat={affected ? 0.1 : 0.35}
              color={
                affected
                  ? SKELETON_COLORS.mineralLow
                  : SKELETON_COLORS.mineralDense
              }
              opacity={ring.opacity}
              roughness={affected ? 0.86 : 0.38}
              transparent={ring.opacity < 1}
            />
          </mesh>
        ))}
      </group>
    )),
    Match.when("rickets", () => (
      <group>
        <mesh
          castShadow
          geometry={metaphysisGeo}
          position={[0, -0.23, 0]}
          rotation={[0, 0, affected ? 0.22 : 0]}
          scale={[1.8, 1, 1.8]}
        >
          <meshPhysicalMaterial
            clearcoat={0.2}
            color={affected ? SKELETON_COLORS.boneSoft : SKELETON_COLORS.bone}
            roughness={affected ? 0.72 : 0.46}
          />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry
            args={[0.145, 0.145, affected ? 0.095 : 0.032, 28]}
          />
          <meshPhysicalMaterial
            clearcoat={0.75}
            color={SKELETON_COLORS.cartilage}
            roughness={0.24}
          />
        </mesh>
      </group>
    )),
    Match.when("arthritis", () => <ArthritisKneeInset affected={affected} />),
    Match.when("scoliosis", () => (
      <group>
        {Arr.map(SPINE_LEVELS, (idx) => {
          const y = (idx - 3) * 0.082;
          const bendX = affected
            ? Math.sin((idx / 6) * Math.PI * 1.6) * 0.135
            : 0;
          return (
            <group
              key={idx}
              position={[bendX, y, 0]}
              rotation={[
                0,
                affected ? bendX * 2.4 : 0,
                affected ? -bendX * 1.1 : 0,
              ]}
            >
              <mesh castShadow>
                <cylinderGeometry args={[0.075, 0.078, 0.056, 22]} />
                <meshPhysicalMaterial
                  clearcoat={0.24}
                  color={SKELETON_COLORS.bone}
                  roughness={0.48}
                />
              </mesh>
              <mesh position={[0, 0.038, 0]}>
                <cylinderGeometry args={[0.07, 0.07, 0.018, 22]} />
                <meshPhysicalMaterial
                  clearcoat={0.55}
                  color={SKELETON_COLORS.disc}
                  roughness={0.34}
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

function BoneCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.45, 4.05] : [0, 1.18, 3.15]}
      cameraTarget={[0.08, 0.88, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.5}
    />
  );
}

export function BoneHealthScene({
  condition,
  parts,
  state,
}: {
  readonly condition: BoneCondition;
  readonly parts: Readonly<Record<BonePart, string>>;
  readonly state: HealthState;
}) {
  const ink = useLabelInk();
  const affected = state === "affected";
  const focus = focusOf(condition);
  const bow = condition === "rickets" && affected ? 0.2 : 0;
  const softBone =
    affected && (condition === "osteomalacia" || condition === "rickets");

  const femurGeo = useMemo(() => buildFemurGeometry(0.58), []);
  const ribsLeft = useMemo(
    () =>
      Arr.map(RIB_PAIRS, (idx) =>
        buildRibGeometry(-1, 0.145 + Math.sin((idx / 4) * Math.PI) * 0.045)
      ),
    []
  );
  const ribsRight = useMemo(
    () =>
      Arr.map(RIB_PAIRS, (idx) =>
        buildRibGeometry(1, 0.145 + Math.sin((idx / 4) * Math.PI) * 0.045)
      ),
    []
  );

  useEffect(
    () => () => {
      femurGeo.dispose();
      Arr.forEach(ribsLeft, (geo) => geo.dispose());
      Arr.forEach(ribsRight, (geo) => geo.dispose());
    },
    [femurGeo, ribsLeft, ribsRight]
  );

  return (
    <group>
      <BoneCamera />

      <group position={[-0.68, 0, 0]}>
        <group position={[0, 1.56, 0]}>
          <mesh castShadow scale={[0.92, 1.05, 1.02]}>
            <sphereGeometry args={[0.135, 28, 22]} />
            <meshPhysicalMaterial
              clearcoat={0.24}
              color={SKELETON_COLORS.bone}
              roughness={0.48}
            />
          </mesh>
          <mesh
            castShadow
            position={[0, -0.1, 0.045]}
            scale={[0.82, 0.72, 0.85]}
          >
            <sphereGeometry args={[0.088, 20, 16]} />
            <meshPhysicalMaterial
              clearcoat={0.24}
              color={SKELETON_COLORS.bone}
              roughness={0.48}
            />
          </mesh>
        </group>

        {Arr.map(SPINE_LEVELS, (idx) => {
          const y = 0.86 + idx * 0.092;
          const x =
            condition === "scoliosis" && affected
              ? Math.sin((idx / 6) * Math.PI * 1.6) * 0.095
              : 0;
          return (
            <group key={idx} position={[x, y, -0.04]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.042, 0.045, 0.068, 18]} />
                <meshPhysicalMaterial
                  clearcoat={0.22}
                  color={SKELETON_COLORS.bone}
                  roughness={0.48}
                />
              </mesh>
              <mesh position={[0, 0.044, 0]}>
                <cylinderGeometry args={[0.038, 0.038, 0.018, 16]} />
                <meshPhysicalMaterial
                  clearcoat={0.5}
                  color={SKELETON_COLORS.disc}
                  roughness={0.35}
                />
              </mesh>
            </group>
          );
        })}

        <mesh castShadow position={[0, 1.18, 0.1]}>
          <capsuleGeometry args={[0.022, 0.24, 10, 16]} />
          <meshPhysicalMaterial
            clearcoat={0.24}
            color={SKELETON_COLORS.bone}
            roughness={0.48}
          />
        </mesh>
        {Arr.map(RIB_PAIRS, (idx) => {
          const y = 1.02 + idx * 0.072;
          return (
            <group key={`rib-${idx}`} position={[0, y, 0]}>
              <mesh castShadow geometry={ribsLeft[idx]}>
                <meshPhysicalMaterial
                  clearcoat={0.24}
                  color={SKELETON_COLORS.bone}
                  roughness={0.48}
                />
              </mesh>
              <mesh castShadow geometry={ribsRight[idx]}>
                <meshPhysicalMaterial
                  clearcoat={0.24}
                  color={SKELETON_COLORS.bone}
                  roughness={0.48}
                />
              </mesh>
            </group>
          );
        })}

        <PelvisSkeletonPart soft={softBone} />

        <mesh
          castShadow
          geometry={femurGeo}
          position={[-0.12 - bow * 0.16, 0.1, 0]}
          rotation={[0, 0, -bow]}
        >
          <meshPhysicalMaterial
            clearcoat={0.22}
            color={softBone ? SKELETON_COLORS.boneSoft : SKELETON_COLORS.bone}
            roughness={softBone ? 0.68 : 0.46}
          />
        </mesh>
        <mesh
          castShadow
          geometry={femurGeo}
          position={[0.12 + bow * 0.16, 0.1, 0]}
          rotation={[0, 0, bow]}
        >
          <meshPhysicalMaterial
            clearcoat={0.22}
            color={softBone ? SKELETON_COLORS.boneSoft : SKELETON_COLORS.bone}
            roughness={softBone ? 0.68 : 0.46}
          />
        </mesh>

        <mesh position={[0, focus.y, 0.22]}>
          <torusGeometry args={[0.105, 0.015, 14, 32]} />
          <meshStandardMaterial
            color={SKELETON_COLORS.regionActive}
            emissive={SKELETON_COLORS.regionActive}
            emissiveIntensity={0.45}
            roughness={0.3}
          />
        </mesh>
      </group>

      <group position={[0.68, 0.9, 0]}>
        <mesh castShadow>
          <torusGeometry args={[0.48, 0.036, 20, 48]} />
          <MetalMaterial color={SKELETON_COLORS.lensRim} roughness={0.26} />
        </mesh>
        <mesh position={[0, 0, -0.02]}>
          <circleGeometry args={[0.46, 48]} />
          <meshPhysicalMaterial
            clearcoat={0.95}
            clearcoatRoughness={0.05}
            color={SKELETON_COLORS.synovialFluid}
            depthWrite={false}
            opacity={0.09}
            roughness={0.08}
            transparent
          />
        </mesh>
        <LensContent affected={affected} condition={condition} />
        <ThreeLabel color={ink} fontSize="compact" position={[0, 0.64, 0]}>
          <span className="font-medium">{parts[focus.part]}</span>
        </ThreeLabel>
        <ThreeLabel color={ink} fontSize="compact" position={[0, -0.64, 0]}>
          <span>{parts[focus.secondary]}</span>
        </ThreeLabel>
      </group>
    </group>
  );
}

useGLTF.preload(HRA_PELVIS_ASSET.path);
useGLTF.preload(HRA_KNEE_JOINT_ASSET.path);
