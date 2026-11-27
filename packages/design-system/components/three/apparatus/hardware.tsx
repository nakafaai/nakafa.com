import { Matter } from "@repo/design-system/components/three/matter/material";

/** How thick a flat bar is. */
export const BAR_TALL = 0.03;

/** The radius of a bullet and the length of its body. */
const ROUND = { long: 0.09, radius: 0.022 } as const;

/**
 * A flat aluminium bar that hangs level, `long` across, with its top face
 * on the origin: what joins springs side by side.
 */
export function Bar({ long }: { readonly long: number }) {
  return (
    <mesh castShadow position={[0, -BAR_TALL / 2, 0]}>
      <boxGeometry args={[long, BAR_TALL, 0.06]} />
      <Matter of="aluminium" />
    </mesh>
  );
}

/**
 * A steel link of two rings that hangs from a rod running along x just
 * above the origin, and carries the eye of whatever hangs with its top at
 * the origin, such as a spring.
 */
export function Link() {
  return (
    <group rotation={[0, Math.PI / 2, 0]}>
      <mesh castShadow position={[0, 0.062, 0]}>
        <torusGeometry args={[0.024, 0.005, 10, 28]} />
        <Matter of="aluminium" />
      </mesh>
      <mesh castShadow position={[0, 0.013, 0]}>
        <torusGeometry args={[0.025, 0.005, 10, 28]} />
        <Matter of="aluminium" />
      </mesh>
    </group>
  );
}

/**
 * A plastic clip on the right edge of a rule at the origin, in `color`,
 * with a thin pointer `reach` long toward +x that shows what the clip marks.
 */
export function Clip({
  color,
  reach,
}: {
  readonly color: string;
  readonly reach: number;
}) {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.06, 0.02, 0.03]} />
        <Matter color={color} of="plastic" />
      </mesh>
      <mesh position={[reach / 2 + 0.02, 0, 0]}>
        <boxGeometry args={[reach, 0.006, 0.006]} />
        <Matter color={color} of="plastic" />
      </mesh>
    </group>
  );
}

/**
 * A brass bullet with a nickel nose pointing along +x, its base on the
 * origin. Once `lodged` only its base shows, flush with the face it went
 * into.
 */
export function Bullet({ lodged = false }: { readonly lodged?: boolean }) {
  if (lodged) {
    return (
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[ROUND.radius, ROUND.radius, 0.012, 20]} />
        <Matter of="brass" />
      </mesh>
    );
  }

  return (
    <group>
      <mesh
        castShadow
        position={[ROUND.long / 2, 0, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <cylinderGeometry args={[ROUND.radius, ROUND.radius, ROUND.long, 20]} />
        <Matter of="brass" />
      </mesh>
      <mesh castShadow position={[ROUND.long, 0, 0]} scale={[2.2, 1, 1]}>
        <sphereGeometry args={[ROUND.radius, 20, 14]} />
        <Matter of="nickel" />
      </mesh>
    </group>
  );
}

/** How long a bullet is from its base to the tip of its nose. */
export const BULLET_LONG = ROUND.long + ROUND.radius * 2.2;
