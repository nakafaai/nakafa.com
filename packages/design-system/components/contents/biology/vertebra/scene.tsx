import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { prepareAnatomicalScene } from "@repo/design-system/components/contents/biology/anatomy";
import { HRA_PELVIS_ASSET } from "@repo/design-system/components/contents/biology/assets";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  VertebraPart,
  VertebraRegion,
} from "@repo/design-system/components/contents/biology/vertebra/model";
import { vertebraSpecOf } from "@repo/design-system/components/contents/biology/vertebra/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  Shape,
  TubeGeometry,
  Vector3,
} from "three";

const BONE_MAT = {
  clearcoat: 0.22,
  clearcoatRoughness: 0.46,
  color: SKELETON_COLORS.bone,
  roughness: 0.48,
  sheen: 0.2,
} as const;

const COLUMN_LEVELS = [
  { region: "lumbar", scale: 1.0, tilt: 0.08, y: 0.44, z: 0.05 },
  { region: "lumbar", scale: 0.94, tilt: 0.05, y: 0.59, z: 0.07 },
  { region: "thoracic", scale: 0.84, tilt: -0.06, y: 0.75, z: -0.01 },
  { region: "thoracic", scale: 0.8, tilt: -0.1, y: 0.9, z: -0.06 },
  { region: "thoracic", scale: 0.76, tilt: -0.07, y: 1.05, z: -0.04 },
  { region: "cervical", scale: 0.66, tilt: 0.06, y: 1.21, z: 0.02 },
  { region: "axis", scale: 0.62, tilt: 0.04, y: 1.35, z: 0.03 },
  { region: "atlas", scale: 0.6, tilt: 0.02, y: 1.48, z: 0.02 },
] as const;

/** Anatomical kidney-shaped vertebral centrum with beveled epiphyseal rims. */
function buildKidneyBody(radius: number, height: number) {
  const s = new Shape();
  s.moveTo(0, -radius * 0.78);
  s.bezierCurveTo(
    radius * 1.18,
    -radius * 0.9,
    radius * 1.2,
    radius * 0.75,
    0,
    radius * 0.68
  );
  s.bezierCurveTo(
    -radius * 1.2,
    radius * 0.75,
    -radius * 1.18,
    -radius * 0.9,
    0,
    -radius * 0.78
  );
  const geo = new ExtrudeGeometry(s, {
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.016,
    bevelThickness: 0.016,
    depth: height,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, height / 2, 0);
  return geo;
}

/** Sculpted neural arch (pedicles + laminae) enclosing the triangular vertebral canal. */
function buildNeuralArch(radius: number) {
  const curve = new CatmullRomCurve3([
    new Vector3(-radius * 0.72, 0, 0.14),
    new Vector3(-radius * 0.92, 0.02, -0.06),
    new Vector3(-radius * 0.45, 0.04, -0.22),
    new Vector3(0, 0.03, -0.27),
    new Vector3(radius * 0.45, 0.04, -0.22),
    new Vector3(radius * 0.92, 0.02, -0.06),
    new Vector3(radius * 0.72, 0, 0.14),
  ]);
  return new TubeGeometry(curve, 36, 0.048, 14, false);
}

/** Sculpted wing-like transverse process. */
function buildTransverseWing(side: -1 | 1) {
  const curve = new CatmullRomCurve3([
    new Vector3(side * 0.14, 0, -0.04),
    new Vector3(side * 0.28, 0.01, -0.08),
    new Vector3(side * 0.39, -0.01, -0.14),
  ]);
  return new TubeGeometry(curve, 18, 0.036, 12, false);
}

/** Tapered posteriorly sloping spinous process. */
function buildSpinousBlade(length: number) {
  const curve = new CatmullRomCurve3([
    new Vector3(0, 0.02, -0.24),
    new Vector3(0, -0.02, -0.24 - length * 0.55),
    new Vector3(0, -0.09, -0.24 - length),
  ]);
  return new TubeGeometry(curve, 18, 0.034, 12, false);
}

function VertebraCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.1, 1.55, 4.15] : [0.05, 1.25, 3.25]}
      cameraTarget={[0.05, 0.84, 0]}
      fov={38}
      maxDistance={6.6}
      minDistance={1.5}
    />
  );
}

/** Real NIH Human Reference Atlas Sacrum/Pelvis anchoring the base of the spine. */
function SacrumPelvisAnchor({ active }: { readonly active: boolean }) {
  const { scene } = useGLTF(HRA_PELVIS_ASSET.path);
  const specimen = useMemo(
    () =>
      prepareAnatomicalScene(scene, {
        fallback: {
          ...BONE_MAT,
          color: active ? SKELETON_COLORS.regionActive : SKELETON_COLORS.bone,
        },
        targetExtent: 0.54,
      }),
    [active, scene]
  );
  return (
    <group position={[0, 0.21, -0.04]} rotation={[0.15, 0.22, 0]}>
      <primitive object={specimen} />
    </group>
  );
}

export function VertebraScene({
  parts,
  region,
}: {
  readonly parts: Readonly<Record<VertebraPart, string>>;
  readonly region: VertebraRegion;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const liftedRef = useRef<Group>(null);
  const spec = vertebraSpecOf(region);

  const miniBody = useMemo(() => buildKidneyBody(0.16, 0.09), []);
  const miniDisc = useMemo(() => buildKidneyBody(0.152, 0.028), []);
  const liftedBody = useMemo(
    () => buildKidneyBody(spec.bodyRadius, 0.19),
    [spec.bodyRadius]
  );
  const archGeo = useMemo(
    () => buildNeuralArch(Math.max(0.16, spec.bodyRadius)),
    [spec.bodyRadius]
  );
  const wingLeft = useMemo(() => buildTransverseWing(-1), []);
  const wingRight = useMemo(() => buildTransverseWing(1), []);
  const spinousGeo = useMemo(
    () => buildSpinousBlade(spec.spinousLength),
    [spec.spinousLength]
  );

  useEffect(
    () => () => {
      miniBody.dispose();
      miniDisc.dispose();
      liftedBody.dispose();
      archGeo.dispose();
      wingLeft.dispose();
      wingRight.dispose();
      spinousGeo.dispose();
    },
    [archGeo, liftedBody, miniBody, miniDisc, spinousGeo, wingLeft, wingRight]
  );

  useFrame((_, delta) => {
    const lifted = liftedRef.current;
    if (lifted === null || !playing) {
      return;
    }
    lifted.rotation.y += simulationStep(delta) * 0.6;
  });

  const isSacralOrCaudal = region === "sacral" || region === "caudal";

  return (
    <group>
      <SimulationTicker running={playing} />
      <VertebraCamera />

      {/* Left: Anatomical S-curved human vertebral column anchored on real HRA sacrum/pelvis */}
      <group position={[-0.82, 0, 0]}>
        <SacrumPelvisAnchor active={isSacralOrCaudal} />
        {Arr.map(COLUMN_LEVELS, (item) => {
          const active = item.region === region;
          return (
            <group
              key={`${item.region}-${item.y}`}
              position={[0, item.y, item.z]}
              rotation={[item.tilt, 0, 0]}
              scale={item.scale}
            >
              <mesh castShadow geometry={miniBody} receiveShadow>
                <meshPhysicalMaterial
                  clearcoat={0.24}
                  color={
                    active
                      ? SKELETON_COLORS.regionActive
                      : SKELETON_COLORS.regionNeutral
                  }
                  roughness={0.48}
                />
              </mesh>
              <mesh
                castShadow
                position={[0, -0.01, -0.17]}
                rotation={[0.35, 0, 0]}
              >
                <capsuleGeometry args={[0.025, 0.12, 8, 12]} />
                <meshPhysicalMaterial
                  color={
                    active
                      ? SKELETON_COLORS.regionActive
                      : SKELETON_COLORS.regionNeutral
                  }
                  roughness={0.5}
                />
              </mesh>
              <mesh geometry={miniDisc} position={[0, 0.062, 0]}>
                <meshPhysicalMaterial
                  clearcoat={0.55}
                  color={SKELETON_COLORS.disc}
                  roughness={0.34}
                />
              </mesh>
            </group>
          );
        })}
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[0.02, 1.66, 0.06]}
        >
          <span>{parts.disc}</span>
        </ThreeLabel>
      </group>

      {/* Right: Enlarged anatomical regional vertebra tilted slightly for 3D depth */}
      <group
        position={[0.58, 0.86, 0]}
        ref={liftedRef}
        rotation={[0.36, -0.42, 0]}
      >
        {spec.hasBody ? (
          <mesh
            castShadow
            geometry={liftedBody}
            position={[0, 0, 0.18]}
            receiveShadow
          >
            <meshPhysicalMaterial
              clearcoat={0.24}
              color={SKELETON_COLORS.bone}
              roughness={0.46}
            />
          </mesh>
        ) : (
          <mesh
            castShadow
            position={[0, 0, 0.12]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[0.16, 0.048, 16, 36]} />
            <meshPhysicalMaterial
              clearcoat={0.24}
              color={SKELETON_COLORS.bone}
              roughness={0.46}
            />
          </mesh>
        )}

        {/* Sculpted neural arch + subtle dark canal depth indicator */}
        <mesh castShadow geometry={archGeo} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.24}
            color={SKELETON_COLORS.bone}
            roughness={0.46}
          />
        </mesh>
        <mesh position={[0, 0, -0.06]}>
          <cylinderGeometry args={[0.095, 0.095, 0.06, 24]} />
          <meshStandardMaterial
            color={SKELETON_COLORS.canal}
            opacity={0.45}
            roughness={0.85}
            transparent
          />
        </mesh>

        {/* Winged transverse processes + posteriorly angled spinous process */}
        <mesh castShadow geometry={wingLeft}>
          <meshPhysicalMaterial
            clearcoat={0.24}
            color={SKELETON_COLORS.bone}
            roughness={0.46}
          />
        </mesh>
        <mesh castShadow geometry={wingRight}>
          <meshPhysicalMaterial
            clearcoat={0.24}
            color={SKELETON_COLORS.bone}
            roughness={0.46}
          />
        </mesh>
        <mesh castShadow geometry={spinousGeo}>
          <meshPhysicalMaterial
            clearcoat={0.24}
            color={SKELETON_COLORS.bone}
            roughness={0.46}
          />
        </mesh>

        {spec.hasDens ? (
          <mesh castShadow position={[0, 0.22, 0.16]}>
            <capsuleGeometry args={[0.048, 0.14, 12, 20]} />
            <meshPhysicalMaterial
              clearcoat={0.3}
              color={SKELETON_COLORS.regionActive}
              roughness={0.4}
            />
          </mesh>
        ) : null}
        {spec.hasForamen ? (
          <mesh position={[0.31, 0.02, -0.09]}>
            <torusGeometry args={[0.032, 0.012, 12, 20]} />
            <meshStandardMaterial
              color={SKELETON_COLORS.canal}
              roughness={0.72}
            />
          </mesh>
        ) : null}
        {spec.hasFacet ? (
          <mesh position={[0.24, 0.04, 0.08]}>
            <sphereGeometry args={[0.048, 18, 16]} />
            <meshPhysicalMaterial
              clearcoat={0.75}
              color={SKELETON_COLORS.cartilage}
              roughness={0.22}
            />
          </mesh>
        ) : null}
      </group>

      {/* Non-overlapping radially fanned labels in stable world space */}
      {spec.hasBody ? (
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[0.58, 1.34, 0.26]}
        >
          <span>{parts.body}</span>
        </ThreeLabel>
      ) : null}
      <ThreeLabel color={ink} fontSize="compact" position={[0.22, 1.16, -0.06]}>
        <span>{parts.canal}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.08, 0.62, 0.08]}>
        <span>{parts.transverse}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.68, 0.36, -0.2]}>
        <span>{parts.spinous}</span>
      </ThreeLabel>
      {spec.hasForamen ? (
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[1.08, 0.72, -0.08]}
        >
          <span>{parts.foramen}</span>
        </ThreeLabel>
      ) : null}
      {spec.hasFacet ? (
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[1.12, 1.06, 0.14]}
        >
          <span>{parts.facet}</span>
        </ThreeLabel>
      ) : null}
      {spec.hasDens ? (
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[1.05, 1.24, 0.16]}
        >
          <span>{parts.dens}</span>
        </ThreeLabel>
      ) : null}
    </group>
  );
}

useGLTF.preload(HRA_PELVIS_ASSET.path);
