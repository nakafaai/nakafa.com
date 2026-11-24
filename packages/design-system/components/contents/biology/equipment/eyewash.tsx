import {
  PLACES,
  WALLS,
} from "@repo/design-system/components/contents/biology/equipment/places";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { Array as Arr } from "effect";

/** The eyewash's two spray heads, 150 mm apart across the yoke. */
const HEADS = [-0.075, 0.075] as const;

/**
 * A deck-mounted eyewash beside the sink: a chrome riser on its flange, a
 * yoke carrying two green spray heads with yellow dust caps that flip off
 * when the water runs, and a green push handle. Its sign hangs on the
 * tiles behind it.
 */
export function Eyewash() {
  const { base } = PLACES.eyewash;
  return (
    <group>
      <group position={base}>
        <mesh castShadow position={[0, 0.003, 0]}>
          <cylinderGeometry args={[0.028, 0.03, 0.006, 32]} />
          <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.15} />
        </mesh>
        <mesh castShadow position={[0, 0.047, 0]}>
          <cylinderGeometry args={[0.011, 0.011, 0.082, 24]} />
          <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.15} />
        </mesh>
        <mesh
          castShadow
          position={[0, 0.088, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.009, 0.009, 0.17, 20]} />
          <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.15} />
        </mesh>
        <mesh castShadow position={[0.03, 0.062, 0]}>
          <boxGeometry args={[0.05, 0.012, 0.016]} />
          <meshPhysicalMaterial
            clearcoat={0.4}
            color={LABORATORY_COLORS.safeGreen}
            roughness={0.4}
          />
        </mesh>
        {Arr.map(HEADS, (z) => (
          <group key={z} position={[0, 0.088, z]}>
            <mesh castShadow position={[0, 0.01, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.02, 16]} />
              <MetalMaterial
                color={LABORATORY_COLORS.chrome}
                roughness={0.15}
              />
            </mesh>
            <mesh castShadow position={[0, 0.024, 0]}>
              <cylinderGeometry args={[0.02, 0.014, 0.012, 28]} />
              <meshPhysicalMaterial
                clearcoat={0.5}
                color={LABORATORY_COLORS.safeGreen}
                roughness={0.35}
              />
            </mesh>
            <mesh castShadow position={[0, 0.0315, 0]}>
              <cylinderGeometry args={[0.021, 0.021, 0.003, 28]} />
              <meshPhysicalMaterial
                clearcoat={0.5}
                color={LABORATORY_COLORS.capYellow}
                roughness={0.35}
              />
            </mesh>
          </group>
        ))}
      </group>
      <group position={[base[0], 1.44, WALLS.back + 0.0015]}>
        <mesh receiveShadow>
          <boxGeometry args={[0.15, 0.15, 0.003]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.safeGreen}
            roughness={0.45}
          />
        </mesh>
        <mesh position={[0, 0.02, 0.002]} scale={[1, 0.5, 0.2]}>
          <torusGeometry args={[0.032, 0.004, 8, 32]} />
          <meshBasicMaterial color={LABORATORY_COLORS.cross} />
        </mesh>
        <mesh position={[0, 0.02, 0.002]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.009, 0.009, 0.001, 20]} />
          <meshBasicMaterial color={LABORATORY_COLORS.cross} />
        </mesh>
        {Arr.map([-0.025, 0, 0.025] as const, (x) => (
          <mesh
            key={x}
            position={[x, -0.035, 0.002]}
            rotation={[0, 0, Math.PI]}
            scale={[1, 1, 0.3]}
          >
            <torusGeometry args={[0.012, 0.0025, 6, 16, Math.PI]} />
            <meshBasicMaterial color={LABORATORY_COLORS.cross} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
