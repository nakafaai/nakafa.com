import { Array as Arr } from "effect";
import { Vector2 } from "three";

/** The radius of the coin, and its turned outline: a raised rim round a struck face. */
const COIN = 0.17;
const COIN_PROFILE = Arr.map(
  [
    [0.0004, 0.014],
    [COIN * 0.82, 0.014],
    [COIN * 0.86, 0.02],
    [COIN * 0.97, 0.02],
    [COIN, 0.017],
    [COIN, 0.003],
    [COIN * 0.97, 0],
    [0.0004, 0],
  ] as const,
  ([radius, along]) => new Vector2(radius, along)
);

/**
 * A struck brass coin lying flat with its face up, turned from the true
 * outline of a coin's rim and face. As a `ghost` it is the image of a coin
 * that an eye sees where no coin is, half seen, ringed in `ring` so a
 * reader finds it.
 *
 * @param color - The colour of its metal
 * @param ghost - Whether it is only the image of a coin
 * @param ring - The ink of the ring round its image
 */
export function Coin({
  color,
  ghost = false,
  ring,
}: {
  readonly color: string;
  readonly ghost?: boolean;
  readonly ring?: string;
}) {
  return (
    <group>
      <mesh castShadow={!ghost} renderOrder={ghost ? 6 : 0}>
        <latheGeometry args={[COIN_PROFILE, 64]} />
        <meshPhysicalMaterial
          color={color}
          depthWrite={!ghost}
          metalness={1}
          opacity={ghost ? 0.4 : 1}
          roughness={0.34}
          transparent={ghost}
        />
      </mesh>
      {ghost && ring !== undefined ? (
        <mesh position={[0, 0.012, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[COIN * 1.12, 0.006, 8, 64]} />
          <meshBasicMaterial color={ring} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}
