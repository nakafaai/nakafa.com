import { useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  useArmGeometries,
  useLegGeometries,
  useMuscleMaterials,
} from "@repo/design-system/components/contents/biology/limb/anatomy";
import { buildBandGeometry } from "@repo/design-system/components/contents/biology/limb/geometry";
import type {
  LegMovement,
  LimbKind,
  LimbPart,
  MuscleId,
} from "@repo/design-system/components/contents/biology/limb/model";
import {
  armPairAt,
  legPairFor,
} from "@repo/design-system/components/contents/biology/limb/model";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { Array as Arr } from "effect";
import { createContext, use, useEffect, useMemo } from "react";

const LimbSceneContext = createContext<{
  readonly angleDeg: number;
  readonly movement: LegMovement;
  readonly muscles: Readonly<Record<MuscleId, string>>;
  readonly parts: Readonly<Record<LimbPart, string>>;
} | null>(null);

const FALLBACK_MOVEMENT: LegMovement = "bend";

function useLimbSceneState() {
  const value = use(LimbSceneContext);
  if (value === null) {
    return {
      angleDeg: 90,
      movement: FALLBACK_MOVEMENT,
      muscles: {
        biceps: "",
        gastrocnemius: "",
        hamstrings: "",
        quadriceps: "",
        tibialis: "",
        triceps: "",
      },
      parts: {
        femur: "",
        humerus: "",
        radius: "",
        tendon: "",
        tibia: "",
        ulna: "",
      },
    };
  }
  return value;
}

function ankleTiltFor(movement: LegMovement) {
  if (movement === "heel") {
    return -0.42;
  }
  if (movement === "toes") {
    return 0.36;
  }
  return 0;
}

function LimbCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.1, 1.5, 3.85] : [0.12, 1.18, 3.05]}
      cameraTarget={[0.08, 0.72, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.5}
    />
  );
}

/** Articulated anatomical human arm with condyled humerus, radius, ulna, olecranon, striated biceps/triceps, and dynamic tendons. */
function ArmAssembly() {
  const { angleDeg, muscles, parts } = useLimbSceneState();
  const ink = useLabelInk();
  const mats = useMuscleMaterials();
  const geos = useArmGeometries();

  const pair = armPairAt(angleDeg);
  const flex = 1 - (angleDeg - 35) / 135;
  const forearmRad = ((180 - angleDeg) * Math.PI) / 180;
  const elbowRot = forearmRad - Math.PI / 2;
  const bicepsActive = pair.contracting === "biceps";

  // Dynamic distal biceps tendon tracking the radial tuberosity as the elbow bends.
  const bicepsTendonGeo = useMemo(() => {
    const radAttachX = Math.cos(elbowRot) * 0.16 - Math.sin(elbowRot) * 0.05;
    const radAttachY =
      0.62 + Math.sin(elbowRot) * 0.16 + Math.cos(elbowRot) * 0.05;
    return buildBandGeometry(
      [
        [0.13, 0.84, 0],
        [0.12 + radAttachX * 0.35, 0.73, 0.01],
        [radAttachX, radAttachY, 0.015],
      ],
      0.02
    );
  }, [elbowRot]);

  const tricepsTendonGeo = useMemo(() => {
    const oleX = Math.cos(elbowRot) * -0.06 - Math.sin(elbowRot) * -0.04;
    const oleY = 0.62 + Math.sin(elbowRot) * -0.06 + Math.cos(elbowRot) * -0.04;
    return buildBandGeometry(
      [
        [-0.13, 0.82, 0],
        [-0.12, 0.7, 0],
        [oleX, oleY, 0],
      ],
      0.021
    );
  }, [elbowRot]);

  useEffect(
    () => () => {
      bicepsTendonGeo.dispose();
      tricepsTendonGeo.dispose();
    },
    [bicepsTendonGeo, tricepsTendonGeo]
  );

  return (
    <group>
      <LimbCamera />
      {/* Sculpted humerus with rounded humeral head & distal condyles */}
      <mesh
        castShadow
        geometry={geos.humerus}
        material={mats.bone}
        position={[0, 0.62, 0]}
        receiveShadow
      />
      <mesh castShadow material={mats.bone} position={[-0.03, 1.46, 0]}>
        <sphereGeometry args={[0.092, 24, 18]} />
      </mesh>
      {/* Articular cartilage cap at elbow trochlea */}
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.072, 20, 16]} />
        <meshPhysicalMaterial
          clearcoat={0.8}
          color={SKELETON_COLORS.cartilage}
          roughness={0.22}
        />
      </mesh>

      {/* Striated fusiform biceps brachii (front, bulges on flexion) */}
      <mesh
        castShadow
        geometry={geos.bicepsBelly}
        material={bicepsActive ? mats.active : mats.relaxed}
        position={[0.135, 1.07 + flex * 0.04, 0]}
        receiveShadow
        scale={[1 + flex * 0.44, 1 - flex * 0.22, 1 + flex * 0.34]}
      />
      {/* Proximal biceps tendon to shoulder */}
      <mesh
        castShadow
        material={mats.tendon}
        position={[0.07, 1.38, 0]}
        rotation={[0, 0, 0.36]}
      >
        <cylinderGeometry args={[0.017, 0.022, 0.18, 12]} />
      </mesh>

      {/* Striated fusiform triceps brachii (back, bulges on extension) */}
      <mesh
        castShadow
        geometry={geos.tricepsBelly}
        material={bicepsActive ? mats.relaxed : mats.active}
        position={[-0.135, 1.06 - flex * 0.03, 0]}
        receiveShadow
        scale={[1.36 - flex * 0.34, 0.82 + flex * 0.2, 1.24 - flex * 0.22]}
      />

      {/* Proximal triceps tendon to upper humerus */}
      <mesh
        castShadow
        material={mats.tendon}
        position={[-0.08, 1.38, 0]}
        rotation={[0, 0, -0.34]}
      >
        <cylinderGeometry args={[0.017, 0.022, 0.18, 12]} />
      </mesh>

      {/* Dynamic fibrous distal tendons */}
      <mesh castShadow geometry={bicepsTendonGeo} material={mats.tendon} />
      <mesh castShadow geometry={tricepsTendonGeo} material={mats.tendon} />

      {/* Forearm (radius + ulna + olecranon + articulated hand) */}
      <group position={[0, 0.62, 0]} rotation={[0, 0, elbowRot]}>
        {/* Radius (thumb side) */}
        <mesh
          castShadow
          geometry={geos.radius}
          material={mats.bone}
          position={[0.04, 0.042, 0.018]}
          receiveShadow
          rotation={[0, 0, -Math.PI / 2]}
        />
        {/* Ulna (pinky side) + hooked olecranon */}
        <mesh
          castShadow
          geometry={geos.ulna}
          material={mats.boneSoft}
          position={[0.01, -0.046, -0.018]}
          receiveShadow
          rotation={[0, 0, -Math.PI / 2]}
        />
        <mesh castShadow geometry={geos.olecranon} material={mats.boneSoft} />

        {/* Articulated anatomical hand (palm + thumb + 4 digits) */}
        <group position={[0.75, 0, 0]}>
          <mesh castShadow material={mats.bone} scale={[1.15, 0.45, 0.92]}>
            <sphereGeometry args={[0.078, 18, 14]} />
          </mesh>
          <mesh castShadow geometry={geos.thumb} material={mats.bone} />
          {Arr.map(geos.fingerCurves, (geo) => (
            <mesh
              castShadow
              geometry={geo}
              key={geo.uuid}
              material={mats.bone}
            />
          ))}
        </group>

        <ThreeLabel color={ink} fontSize="compact" position={[0.52, 0.22, 0]}>
          <span>{parts.radius}</span>
        </ThreeLabel>
        <ThreeLabel color={ink} fontSize="compact" position={[0.48, -0.24, 0]}>
          <span>{parts.ulna}</span>
        </ThreeLabel>
      </group>

      <ThreeLabel color={ink} fontSize="compact" position={[-0.05, 1.62, 0]}>
        <span>{parts.humerus}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.54, 1.18, 0]}>
        <span>{muscles.biceps}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.52, 1.12, 0]}>
        <span>{muscles.triceps}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.46, 0.8, 0.16]}>
        <span>{parts.tendon}</span>
      </ThreeLabel>
    </group>
  );
}

/** Articulated anatomical human leg with condyled femur, patella, tibia, fibula, striated muscles, and arched foot. */
function LegAssembly() {
  const { movement, muscles, parts } = useLimbSceneState();
  const ink = useLabelInk();
  const mats = useMuscleMaterials();
  const geos = useLegGeometries();

  const pair = legPairFor(movement);
  const kneeBend = movement === "bend" ? -0.92 : -0.14;
  const ankleTilt = ankleTiltFor(movement);
  const quadActive = pair.contracting === "quadriceps";
  const hamActive = pair.contracting === "hamstrings";
  const tibActive = pair.contracting === "tibialis";
  const calfActive = pair.contracting === "gastrocnemius";

  return (
    <group>
      <LimbCamera />
      {/* Sculpted femur with femoral head & distal condyles */}
      <mesh
        castShadow
        geometry={geos.femur}
        material={mats.bone}
        position={[0, 0.78, 0]}
        receiveShadow
      />
      <mesh castShadow material={mats.bone} position={[-0.06, 1.54, 0]}>
        <sphereGeometry args={[0.088, 22, 16]} />
      </mesh>
      {/* Articular knee cartilage & sculpted patella */}
      <mesh position={[0, 0.78, 0]}>
        <sphereGeometry args={[0.078, 20, 16]} />
        <meshPhysicalMaterial
          clearcoat={0.82}
          color={SKELETON_COLORS.cartilage}
          roughness={0.22}
        />
      </mesh>
      <mesh
        castShadow
        material={mats.bone}
        position={[0.115, 0.79, 0]}
        scale={[0.55, 1.05, 0.85]}
      >
        <sphereGeometry args={[0.056, 18, 14]} />
      </mesh>

      {/* Striated quadriceps femoris (front thigh) + proximal origin tendon */}
      <mesh
        castShadow
        geometry={geos.quadBelly}
        material={quadActive ? mats.active : mats.relaxed}
        position={[0.135, 1.18, 0]}
        receiveShadow
        scale={quadActive ? [1.22, 0.9, 1.18] : [0.96, 1.04, 0.96]}
      />
      <mesh
        castShadow
        material={mats.tendon}
        position={[0.075, 1.47, 0]}
        rotation={[0, 0, 0.42]}
      >
        <cylinderGeometry args={[0.017, 0.022, 0.18, 12]} />
      </mesh>
      {/* Striated hamstrings (back thigh) + proximal & distal tendons */}
      <mesh
        castShadow
        geometry={geos.hamBelly}
        material={hamActive ? mats.active : mats.relaxed}
        position={[-0.135, 1.17, 0]}
        receiveShadow
        scale={hamActive ? [1.24, 0.9, 1.18] : [0.96, 1.04, 0.96]}
      />
      <mesh
        castShadow
        material={mats.tendon}
        position={[-0.085, 1.46, 0]}
        rotation={[0, 0, -0.36]}
      >
        <cylinderGeometry args={[0.017, 0.022, 0.18, 12]} />
      </mesh>
      <mesh
        castShadow
        material={mats.tendon}
        position={[-0.085, 0.85, 0]}
        rotation={[0, 0, 0.32]}
      >
        <cylinderGeometry args={[0.018, 0.016, 0.18, 12]} />
      </mesh>

      {/* Lower leg (tibia, fibula, patellar tendon, tibialis, calf, Achilles, arched foot) */}
      <group position={[0, 0.78, 0]} rotation={[0, 0, kneeBend]}>
        <mesh
          castShadow
          geometry={geos.patellarTendon}
          material={mats.tendon}
        />
        {/* Tibia (medial shinbone) */}
        <mesh
          castShadow
          geometry={geos.tibia}
          material={mats.bone}
          position={[0.01, -0.68, 0.018]}
          receiveShadow
        />
        {/* Fibula (slender lateral bone) */}
        <mesh
          castShadow
          geometry={geos.fibula}
          material={mats.boneSoft}
          position={[-0.032, -0.66, -0.048]}
          receiveShadow
        />

        {/* Striated tibialis anterior (front shin) */}
        <mesh
          castShadow
          geometry={geos.tibialisBelly}
          material={tibActive ? mats.active : mats.relaxed}
          position={[0.095, -0.32, 0.01]}
          receiveShadow
          scale={tibActive ? [1.26, 0.92, 1.18] : [0.96, 1.02, 0.96]}
        />
        {/* Bilobed striated gastrocnemius (calf) */}
        <mesh
          castShadow
          geometry={geos.calfBelly}
          material={calfActive ? mats.active : mats.relaxed}
          position={[-0.105, -0.25, 0]}
          receiveShadow
          scale={calfActive ? [1.26, 0.9, 1.2] : [0.96, 1.04, 0.96]}
        />
        {/* Prominent pearlescent Achilles tendon */}
        <mesh
          castShadow
          geometry={geos.achillesTendon}
          material={mats.tendon}
        />

        {/* Sculpted anatomical foot with calcaneus heel, arched instep & toes */}
        <group position={[0, -0.68, 0]} rotation={[0, 0, ankleTilt]}>
          <mesh castShadow geometry={geos.footArch} material={mats.bone} />
          <mesh castShadow material={mats.bone} position={[-0.075, -0.02, 0]}>
            <sphereGeometry args={[0.046, 16, 12]} />
          </mesh>
          {Arr.map([-0.036, -0.018, 0, 0.018, 0.036] as const, (zOff) => (
            <mesh
              castShadow
              key={`toe-${zOff}`}
              material={mats.boneSoft}
              position={[0.31 + (zOff === -0.036 ? 0.018 : 0), -0.028, zOff]}
              scale={[1.4, 0.72, 0.78]}
            >
              <sphereGeometry args={[zOff === -0.036 ? 0.018 : 0.013, 10, 8]} />
            </mesh>
          ))}
        </group>

        <ThreeLabel color={ink} fontSize="compact" position={[0.34, -0.58, 0]}>
          <span>{parts.tibia}</span>
        </ThreeLabel>
      </group>

      <ThreeLabel color={ink} fontSize="compact" position={[0, 1.66, 0]}>
        <span>{parts.femur}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.52, 1.26, 0]}>
        <span>{muscles.quadriceps}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.52, 1.26, 0]}>
        <span>{muscles.hamstrings}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.56, 0.48, 0]}>
        <span>{muscles.gastrocnemius}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.56, 0.56, 0]}>
        <span>{muscles.tibialis}</span>
      </ThreeLabel>
    </group>
  );
}

export function MusclePairScene({
  angleDeg,
  limb,
  movement,
  muscles,
  parts,
}: {
  readonly angleDeg: number;
  readonly limb: LimbKind;
  readonly movement: LegMovement;
  readonly muscles: Readonly<Record<MuscleId, string>>;
  readonly parts: Readonly<Record<LimbPart, string>>;
}) {
  const value = useMemo(
    () => ({ angleDeg, movement, muscles, parts }),
    [angleDeg, movement, muscles, parts]
  );
  return (
    <LimbSceneContext value={value}>
      {limb === "arm" ? <ArmAssembly /> : <LegAssembly />}
    </LimbSceneContext>
  );
}
