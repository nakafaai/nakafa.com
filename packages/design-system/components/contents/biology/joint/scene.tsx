import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { prepareAnatomicalScene } from "@repo/design-system/components/contents/biology/anatomy";
import { HRA_KNEE_JOINT_ASSET } from "@repo/design-system/components/contents/biology/assets";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  buildBandGeometry,
  buildCentrumGeometry,
  buildLongBoneGeometry,
  buildMuscleBellyGeometry,
  buildSutureSeamGeometry,
} from "@repo/design-system/components/contents/biology/joint/geometry";
import type {
  JointKind,
  JointPart,
} from "@repo/design-system/components/contents/biology/joint/model";
import { jointAnglesAt } from "@repo/design-system/components/contents/biology/joint/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { DoubleSide } from "three";

const SKELETON_RULES = [
  {
    clearcoat: 0.72,
    clearcoatRoughness: 0.16,
    color: SKELETON_COLORS.cartilage,
    match: "cartilage",
    roughness: 0.24,
    sheen: 0.45,
  },
  {
    clearcoat: 0.45,
    clearcoatRoughness: 0.32,
    color: SKELETON_COLORS.disc,
    match: "meniscus",
    roughness: 0.36,
    sheen: 0.4,
  },
] as const;

const BONE_FALLBACK = {
  clearcoat: 0.22,
  clearcoatRoughness: 0.48,
  color: SKELETON_COLORS.bone,
  roughness: 0.46,
  sheen: 0.2,
} as const;

function JointCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.1, 1.45, 4.15] : [0.08, 1.24, 3.45]}
      cameraTarget={[0.04, 0.62, 0]}
      fov={38}
      maxDistance={6.8}
      minDistance={1.4}
    />
  );
}

/** Real NIH Human Reference Atlas knee specimen shown alongside the articulating hinge. */
function KneeReferenceSpecimen() {
  const { scene } = useGLTF(HRA_KNEE_JOINT_ASSET.path);
  const specimen = useMemo(
    () =>
      prepareAnatomicalScene(scene, {
        fallback: BONE_FALLBACK,
        rules: SKELETON_RULES,
        targetExtent: 1.28,
      }),
    [scene]
  );
  return (
    <group position={[-0.74, 0.68, 0.04]} rotation={[0.05, 0.42, 0.04]}>
      <primitive object={specimen} />
    </group>
  );
}

export function JointScene({
  joint,
  motion,
  onMotionChange,
  parts,
}: {
  readonly joint: JointKind;
  readonly motion: number;
  readonly onMotionChange: (next: number) => void;
  readonly parts: Readonly<Record<JointPart, string>>;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const movingRef = useRef<Group>(null);
  const clock = useRef(0);

  const longBone = useMemo(() => buildLongBoneGeometry(0.76, 0.068), []);
  const distalBone = useMemo(() => buildLongBoneGeometry(0.72, 0.064), []);
  const centrumGeo = useMemo(() => buildCentrumGeometry(0.32, 0.22), []);
  const discGeo = useMemo(() => buildCentrumGeometry(0.305, 0.095), []);
  const muscleGeo = useMemo(buildMuscleBellyGeometry, []);
  const sutureGeo = useMemo(buildSutureSeamGeometry, []);
  const ligamentGeo = useMemo(
    () =>
      buildBandGeometry(
        [
          [-0.26, -0.05, 0.14],
          [-0.08, -0.14, 0.17],
          [0.1, -0.14, 0.17],
          [0.24, -0.06, 0.13],
        ],
        0.022
      ),
    []
  );
  const tendonGeo = useMemo(
    () =>
      buildBandGeometry(
        [
          [-0.24, 0.23, 0.02],
          [-0.06, 0.2, 0.05],
          [0.14, 0.14, 0.03],
        ],
        0.02
      ),
    []
  );

  useEffect(
    () => () => {
      longBone.dispose();
      distalBone.dispose();
      centrumGeo.dispose();
      discGeo.dispose();
      muscleGeo.dispose();
      sutureGeo.dispose();
      ligamentGeo.dispose();
      tendonGeo.dispose();
    },
    [
      centrumGeo,
      discGeo,
      distalBone,
      ligamentGeo,
      longBone,
      muscleGeo,
      sutureGeo,
      tendonGeo,
    ]
  );

  useFrame((_, delta) => {
    const dt = simulationStep(delta);
    let current = motion;
    if (playing) {
      clock.current += dt;
      current = 0.5 + 0.5 * Math.sin(clock.current * 1.8);
      if (Math.abs(current - motion) > 0.04) {
        onMotionChange(Math.round(current * 100) / 100);
      }
    }
    const group = movingRef.current;
    if (group === null) {
      return;
    }
    const angles = jointAnglesAt(joint, current);
    group.rotation.set(angles.pitchRad, angles.yawRad, angles.rollRad);
  });

  if (joint === "suture") {
    return (
      <group>
        <SimulationTicker running={playing} />
        <JointCamera />
        <mesh castShadow position={[-0.06, 0.58, 0]} receiveShadow>
          <sphereGeometry
            args={[0.48, 36, 28, Math.PI * 0.52, Math.PI * 0.96]}
          />
          <meshPhysicalMaterial
            clearcoat={0.22}
            color={SKELETON_COLORS.bone}
            roughness={0.48}
            side={DoubleSide}
          />
        </mesh>
        <mesh castShadow position={[0.06, 0.58, 0]} receiveShadow>
          <sphereGeometry
            args={[0.48, 36, 28, -Math.PI * 0.48, Math.PI * 0.96]}
          />
          <meshPhysicalMaterial
            clearcoat={0.22}
            color={SKELETON_COLORS.bone}
            roughness={0.48}
            side={DoubleSide}
          />
        </mesh>
        <mesh castShadow geometry={sutureGeo} position={[0, 0.04, 0.16]}>
          <meshPhysicalMaterial
            color={SKELETON_COLORS.ligament}
            roughness={0.72}
          />
        </mesh>
        <ThreeLabel color={ink} fontSize="compact" position={[-0.62, 1.02, 0]}>
          <span>{parts.bone}</span>
        </ThreeLabel>
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[0.62, 0.62, 0.25]}
        >
          <span>{parts.ligament}</span>
        </ThreeLabel>
      </group>
    );
  }

  if (joint === "disc") {
    return (
      <group>
        <SimulationTicker running={playing} />
        <JointCamera />
        <mesh
          castShadow
          geometry={centrumGeo}
          position={[0, 0.26, 0]}
          receiveShadow
        >
          <meshPhysicalMaterial
            clearcoat={0.22}
            color={SKELETON_COLORS.bone}
            roughness={0.48}
          />
        </mesh>
        <mesh castShadow geometry={discGeo} position={[0, 0.49, 0]}>
          <meshPhysicalMaterial
            clearcoat={0.55}
            clearcoatRoughness={0.22}
            color={SKELETON_COLORS.cartilage}
            roughness={0.34}
          />
        </mesh>
        <group position={[0, 0.56, 0]} ref={movingRef}>
          <mesh
            castShadow
            geometry={centrumGeo}
            position={[0, 0.15, 0]}
            receiveShadow
          >
            <meshPhysicalMaterial
              clearcoat={0.22}
              color={SKELETON_COLORS.bone}
              roughness={0.48}
            />
          </mesh>
        </group>
        <ThreeLabel color={ink} fontSize="compact" position={[-0.68, 0.82, 0]}>
          <span>{parts.bone}</span>
        </ThreeLabel>
        <ThreeLabel color={ink} fontSize="compact" position={[0.68, 0.5, 0.1]}>
          <span>{parts.cartilage}</span>
        </ThreeLabel>
      </group>
    );
  }

  const isBallSocket = joint === "ballSocket";

  return (
    <group>
      <SimulationTicker running={playing} />
      <JointCamera />

      {isBallSocket ? null : <KneeReferenceSpecimen />}

      <group position={[isBallSocket ? 0 : 0.42, 0.62, 0]}>
        <mesh
          castShadow
          geometry={longBone}
          position={[-0.04, 0, 0]}
          receiveShadow
          rotation={[0, 0, Math.PI / 2]}
        >
          <meshPhysicalMaterial
            clearcoat={0.24}
            clearcoatRoughness={0.44}
            color={SKELETON_COLORS.bone}
            roughness={0.46}
          />
        </mesh>

        <mesh position={[-0.04, 0, 0]}>
          <sphereGeometry
            args={[
              isBallSocket ? 0.165 : 0.135,
              32,
              24,
              0,
              Math.PI * 2,
              0,
              Math.PI * 0.65,
            ]}
          />
          <meshPhysicalMaterial
            clearcoat={0.85}
            clearcoatRoughness={0.12}
            color={SKELETON_COLORS.cartilage}
            roughness={0.2}
          />
        </mesh>

        <mesh position={[0.02, 0, 0]}>
          <sphereGeometry args={[0.21, 32, 24]} />
          <meshPhysicalMaterial
            clearcoat={0.9}
            color={SKELETON_COLORS.synovialFluid}
            depthWrite={false}
            ior={1.36}
            opacity={0.26}
            roughness={0.08}
            transparent
          />
        </mesh>

        <mesh position={[0.02, 0, 0]} rotation={[0, 0, Math.PI * 0.12]}>
          <torusGeometry args={[0.215, 0.022, 16, 42, Math.PI * 1.45]} />
          <meshPhysicalMaterial
            clearcoat={0.45}
            color={SKELETON_COLORS.membraneHealthy}
            roughness={0.42}
          />
        </mesh>

        <mesh castShadow geometry={ligamentGeo}>
          <meshPhysicalMaterial
            color={SKELETON_COLORS.ligament}
            roughness={0.58}
          />
        </mesh>

        <mesh
          castShadow
          geometry={muscleGeo}
          position={[-0.44, 0.22, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <meshPhysicalMaterial
            clearcoat={0.35}
            clearcoatRoughness={0.4}
            color={SKELETON_COLORS.muscleContract}
            roughness={0.52}
          />
        </mesh>
        <mesh castShadow geometry={tendonGeo}>
          <meshPhysicalMaterial
            clearcoat={0.4}
            color={SKELETON_COLORS.tendon}
            roughness={0.38}
          />
        </mesh>

        <group position={[0.04, 0, 0]} ref={movingRef}>
          <mesh
            castShadow
            geometry={distalBone}
            position={[0.02, 0, 0]}
            receiveShadow
            rotation={[0, 0, -Math.PI / 2]}
          >
            <meshPhysicalMaterial
              clearcoat={0.24}
              clearcoatRoughness={0.44}
              color={SKELETON_COLORS.bone}
              roughness={0.46}
            />
          </mesh>
        </group>

        <ThreeLabel color={ink} fontSize="compact" position={[-0.58, 0.44, 0]}>
          <span>{parts.muscle}</span>
        </ThreeLabel>
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[-0.1, 0.56, 0.08]}
        >
          <span>{parts.tendon}</span>
        </ThreeLabel>
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[0.64, 0.44, 0.08]}
        >
          <span>{parts.membrane}</span>
        </ThreeLabel>
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[0.68, 0.06, 0.14]}
        >
          <span>{parts.fluid}</span>
        </ThreeLabel>
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[-0.58, -0.22, 0.08]}
        >
          <span>{parts.bone}</span>
        </ThreeLabel>
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[-0.18, -0.46, 0.14]}
        >
          <span>{parts.cartilage}</span>
        </ThreeLabel>
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[0.56, -0.34, 0.16]}
        >
          <span>{parts.ligament}</span>
        </ThreeLabel>
      </group>
    </group>
  );
}

useGLTF.preload(HRA_KNEE_JOINT_ASSET.path);
