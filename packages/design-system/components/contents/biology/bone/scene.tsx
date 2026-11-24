import { useThree } from "@react-three/fiber";
import type {
  BoneCondition,
  BonePart,
  HealthState,
} from "@repo/design-system/components/contents/biology/bone/model";
import { focusOf } from "@repo/design-system/components/contents/biology/bone/model";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { Array as Arr, Match } from "effect";

const SPINE_BLOCKS = [0, 1, 2, 3, 4, 5, 6] as const;
const TRABECULAE = [-0.14, -0.07, 0, 0.07, 0.14] as const;

function LensContent({
  affected,
  condition,
}: {
  readonly affected: boolean;
  readonly condition: BoneCondition;
}) {
  return Match.value(condition).pipe(
    Match.when("osteoporosis", () => (
      <group>
        {Arr.map(TRABECULAE, (offset) => (
          <mesh
            key={`h-${offset}`}
            position={[0, offset, 0]}
            scale={[1, affected ? 0.35 : 1, 1]}
          >
            <boxGeometry args={[0.42, 0.036, 0.04]} />
            <meshStandardMaterial
              color={
                affected
                  ? SKELETON_COLORS.spongyPorous
                  : SKELETON_COLORS.spongyHealthy
              }
              roughness={0.72}
            />
          </mesh>
        ))}
        {Arr.map(TRABECULAE, (offset) => (
          <mesh
            key={`v-${offset}`}
            position={[offset, 0, 0]}
            scale={[affected ? 0.35 : 1, 1, 1]}
          >
            <boxGeometry args={[0.036, 0.42, 0.04]} />
            <meshStandardMaterial
              color={
                affected
                  ? SKELETON_COLORS.spongyPorous
                  : SKELETON_COLORS.spongyHealthy
              }
              roughness={0.72}
            />
          </mesh>
        ))}
      </group>
    )),
    Match.when("osteomalacia", () => (
      <mesh rotation={[0, 0, affected ? 0.18 : 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.48, 20]} />
        <meshStandardMaterial
          color={
            affected ? SKELETON_COLORS.mineralLow : SKELETON_COLORS.mineralDense
          }
          roughness={affected ? 0.88 : 0.45}
        />
      </mesh>
    )),
    Match.when("rickets", () => (
      <group>
        <mesh position={[0, 0.12, 0]} rotation={[0, 0, affected ? 0.22 : 0]}>
          <cylinderGeometry args={[0.11, 0.13, 0.24, 16]} />
          <meshStandardMaterial
            color={affected ? SKELETON_COLORS.boneSoft : SKELETON_COLORS.bone}
            roughness={0.68}
          />
        </mesh>
        <mesh position={[0, -0.02, 0]}>
          <cylinderGeometry args={[0.14, 0.14, affected ? 0.09 : 0.035, 18]} />
          <meshStandardMaterial
            color={SKELETON_COLORS.cartilage}
            roughness={0.45}
          />
        </mesh>
        <mesh position={[0, -0.15, 0]} rotation={[0, 0, affected ? -0.16 : 0]}>
          <cylinderGeometry args={[0.12, 0.11, 0.22, 16]} />
          <meshStandardMaterial
            color={affected ? SKELETON_COLORS.boneSoft : SKELETON_COLORS.bone}
            roughness={0.68}
          />
        </mesh>
      </group>
    )),
    Match.when("arthritis", () => (
      <group>
        <mesh position={[0, 0.16, 0]}>
          <sphereGeometry args={[0.14, 18, 14]} />
          <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.04, 0]} scale={[1, affected ? 0.25 : 1, 1]}>
          <cylinderGeometry args={[0.15, 0.15, 0.06, 18]} />
          <meshStandardMaterial
            color={
              affected
                ? SKELETON_COLORS.cartilageWorn
                : SKELETON_COLORS.cartilage
            }
            roughness={0.42}
          />
        </mesh>
        <mesh position={[0, -0.12, 0]}>
          <sphereGeometry args={[0.14, 18, 14]} />
          <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <torusGeometry args={[0.19, affected ? 0.042 : 0.022, 12, 24]} />
          <meshStandardMaterial
            color={
              affected
                ? SKELETON_COLORS.membraneInflamed
                : SKELETON_COLORS.membraneHealthy
            }
            roughness={0.48}
          />
        </mesh>
      </group>
    )),
    Match.when("scoliosis", () => (
      <group>
        {Arr.map(SPINE_BLOCKS, (idx) => {
          const y = (idx - 3) * 0.075;
          const bendX = affected
            ? Math.sin((idx / 6) * Math.PI * 1.5) * 0.12
            : 0;
          return (
            <mesh
              key={idx}
              position={[bendX, y, 0]}
              rotation={[0, affected ? bendX * 2.2 : 0, 0]}
            >
              <boxGeometry args={[0.12, 0.055, 0.1]} />
              <meshStandardMaterial
                color={SKELETON_COLORS.bone}
                roughness={0.58}
              />
            </mesh>
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
      cameraPosition={narrow ? [0, 1.4, 3.85] : [0, 1.15, 3.05]}
      cameraTarget={[0.12, 0.85, 0]}
      fov={38}
      maxDistance={6}
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
  const affected = state === "affected";
  const focus = focusOf(condition);
  const bow = condition === "rickets" && affected ? 0.18 : 0;

  return (
    <group>
      <BoneCamera />
      {/* Simplified human skeleton */}
      <group position={[-0.65, 0, 0]}>
        <mesh castShadow position={[0, 1.54, 0]}>
          <sphereGeometry args={[0.15, 18, 14]} />
          <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.58} />
        </mesh>
        {Arr.map(SPINE_BLOCKS, (idx) => {
          const y = 0.82 + idx * 0.095;
          const x =
            condition === "scoliosis" && affected
              ? Math.sin((idx / 6) * Math.PI * 1.6) * 0.09
              : 0;
          return (
            <mesh castShadow key={idx} position={[x, y, 0]}>
              <cylinderGeometry args={[0.042, 0.045, 0.075, 12]} />
              <meshStandardMaterial
                color={SKELETON_COLORS.bone}
                roughness={0.58}
              />
            </mesh>
          );
        })}
        <mesh castShadow position={[0, 1.16, 0]} scale={[1.15, 0.9, 0.72]}>
          <cylinderGeometry args={[0.19, 0.16, 0.36, 16]} />
          <meshStandardMaterial
            color={SKELETON_COLORS.bone}
            opacity={0.72}
            roughness={0.58}
            transparent
          />
        </mesh>
        <mesh castShadow position={[0, 0.74, 0]} scale={[1.2, 0.6, 0.75]}>
          <boxGeometry args={[0.26, 0.18, 0.16]} />
          <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.58} />
        </mesh>
        <mesh
          castShadow
          position={[-0.12 - bow * 0.18, 0.42, 0]}
          rotation={[0, 0, -bow]}
        >
          <cylinderGeometry args={[0.036, 0.032, 0.62, 12]} />
          <meshStandardMaterial
            color={
              affected && condition === "osteomalacia"
                ? SKELETON_COLORS.boneSoft
                : SKELETON_COLORS.bone
            }
            roughness={0.62}
          />
        </mesh>
        <mesh
          castShadow
          position={[0.12 + bow * 0.18, 0.42, 0]}
          rotation={[0, 0, bow]}
        >
          <cylinderGeometry args={[0.036, 0.032, 0.62, 12]} />
          <meshStandardMaterial
            color={
              affected && condition === "osteomalacia"
                ? SKELETON_COLORS.boneSoft
                : SKELETON_COLORS.bone
            }
            roughness={0.62}
          />
        </mesh>
        <mesh position={[0, focus.y, 0.22]}>
          <ringGeometry args={[0.08, 0.11, 24]} />
          <meshBasicMaterial color={SKELETON_COLORS.regionActive} />
        </mesh>
      </group>

      {/* Magnifying lens */}
      <group position={[0.72, 0.92, 0]}>
        <mesh castShadow>
          <torusGeometry args={[0.48, 0.042, 16, 36]} />
          <meshStandardMaterial
            color={SKELETON_COLORS.lensRim}
            metalness={0.45}
            roughness={0.35}
          />
        </mesh>
        <LensContent affected={affected} condition={condition} />
        <ThreeLabel
          color={SKELETON_COLORS.labelInk}
          fontSize="compact"
          position={[0, 0.62, 0]}
        >
          <span className="font-medium">{parts[focus.part]}</span>
        </ThreeLabel>
        <ThreeLabel
          color={SKELETON_COLORS.labelInk}
          fontSize="compact"
          position={[0, -0.6, 0]}
        >
          <span>{parts[focus.secondary]}</span>
        </ThreeLabel>
      </group>
    </group>
  );
}
