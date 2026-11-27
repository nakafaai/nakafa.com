import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { LAMP_COLORS } from "@repo/design-system/lib/material/lamp";
import { useRef } from "react";
import type { Group } from "three";

/** A panel-mount toggle switch, in metres. */
const SWITCH = {
  bushing: { height: 0.005, radius: 0.0031 },
  // The knurled dress ring a finger tightens, its flats catching the light.
  knurl: { radius: 0.0046 },
  lever: { length: 0.019, root: 0.0026, tip: 0.0017 },
  nut: { height: 0.0028, radius: 0.0068 },
  plate: { depth: 0.036, height: 0.0012, width: 0.024 },
} as const;

/** How far the lever leans from upright to either side, in radians (16 degrees). */
const THROW = (16 * Math.PI) / 180;

/** How quickly the lever snaps over, per second; a real toggle flips in a few milliseconds. */
const SNAP = 40;

/**
 * A chrome bat-handle toggle switch through a brushed steel plate: the hex
 * nut that clamps it, its knurled dress ring and threaded bushing, and the
 * lever, which leans back
 * toward its lamp when the switch is on and toward the reader when it is
 * off. A flipped lever snaps across instead of jumping.
 */
export function ToggleSwitch({ on }: { readonly on: boolean }) {
  const lever = useRef<Group>(null);
  const target = on ? -THROW : THROW;

  useFrame((state, delta) => {
    const current = lever.current;
    if (current === null) {
      return;
    }
    const gap = target - current.rotation.x;
    if (Math.abs(gap) < 0.002) {
      current.rotation.x = target;
      return;
    }
    current.rotation.x += gap * Math.min(1, delta * SNAP);
    state.invalidate();
  });

  return (
    <group>
      <RoundedBox
        args={[SWITCH.plate.width, SWITCH.plate.height, SWITCH.plate.depth]}
        castShadow
        position={[0, SWITCH.plate.height / 2, 0]}
        radius={0.0005}
        receiveShadow
      >
        <MetalMaterial color={LAMP_COLORS.switchPlate} roughness={0.42} />
      </RoundedBox>
      <mesh
        castShadow
        position={[0, SWITCH.plate.height + SWITCH.nut.height / 2, 0]}
      >
        <cylinderGeometry
          args={[SWITCH.nut.radius, SWITCH.nut.radius, SWITCH.nut.height, 6]}
        />
        <MetalMaterial color={LAMP_COLORS.chrome} roughness={0.18} />
      </mesh>
      <mesh
        castShadow
        position={[0, SWITCH.plate.height + SWITCH.nut.height + 0.0011, 0]}
      >
        <cylinderGeometry
          args={[SWITCH.knurl.radius, SWITCH.knurl.radius, 0.0022, 40]}
        />
        <meshPhysicalMaterial
          args={[
            {
              color: LAMP_COLORS.chrome,
              flatShading: true,
              metalness: 1,
              roughness: 0.3,
            },
          ]}
        />
      </mesh>
      <mesh
        castShadow
        position={[
          0,
          SWITCH.plate.height + SWITCH.nut.height + SWITCH.bushing.height / 2,
          0,
        ]}
      >
        <cylinderGeometry
          args={[
            SWITCH.bushing.radius,
            SWITCH.bushing.radius,
            SWITCH.bushing.height,
            20,
          ]}
        />
        <MetalMaterial color={LAMP_COLORS.chrome} roughness={0.22} />
      </mesh>
      <group
        position={[
          0,
          SWITCH.plate.height + SWITCH.nut.height + SWITCH.bushing.height,
          0,
        ]}
        ref={lever}
        rotation={[target, 0, 0]}
      >
        <mesh castShadow position={[0, SWITCH.lever.length / 2, 0]}>
          <cylinderGeometry
            args={[
              SWITCH.lever.tip,
              SWITCH.lever.root,
              SWITCH.lever.length,
              32,
            ]}
          />
          <MetalMaterial color={LAMP_COLORS.chrome} roughness={0.12} />
        </mesh>
        <mesh castShadow position={[0, SWITCH.lever.length, 0]}>
          <sphereGeometry args={[SWITCH.lever.tip * 1.15, 28, 20]} />
          <MetalMaterial color={LAMP_COLORS.chrome} roughness={0.12} />
        </mesh>
      </group>
    </group>
  );
}
