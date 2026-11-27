/**
 * A bubble of gas in a liquid: a thin, bright film about the gas, tinted by
 * what it is. The lesson moves it; it writes no depth, so bubbles and the
 * liquid about them draw in any order.
 *
 * @example
 * <Bubble color={hydrogen} radius={0.002} />
 *
 * @param color - The tint of the gas
 * @param radius - The bubble's radius, in the units of the group it is in
 */
export function Bubble({
  color,
  radius,
}: {
  readonly color: string;
  readonly radius: number;
}) {
  return (
    <mesh>
      <sphereGeometry args={[radius, 16, 12]} />
      <meshPhysicalMaterial
        clearcoat={1}
        clearcoatRoughness={0.05}
        color={color}
        depthWrite={false}
        ior={1.333}
        opacity={0.34}
        roughness={0.04}
        transparent
      />
    </mesh>
  );
}
