/**
 * An eye set into a head: a wet, domed globe with a dark pupil in a
 * coloured iris, under the clear film of its cornea, which catches the
 * light as a living eye does.
 *
 * @param at - Where the eye sits on the head
 * @param look - The way the eye faces, as turns about y and z in radians
 * @param size - The eye's radius, in scene units
 * @param iris - The colour round the pupil
 * @param pupil - The colour of the pupil
 */
export function Eye({
  at,
  iris,
  look,
  pupil,
  size,
}: {
  readonly at: readonly [number, number, number];
  readonly iris: string;
  readonly look: readonly [number, number];
  readonly pupil: string;
  readonly size: number;
}) {
  return (
    <group position={[at[0], at[1], at[2]]} rotation={[0, look[0], look[1]]}>
      <mesh scale={[0.55, 1, 1]}>
        <sphereGeometry args={[size, 20, 14]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.04}
          color={iris}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[size * 0.36, 0, 0]} scale={[0.4, 1, 1]}>
        <sphereGeometry args={[size * 0.56, 16, 12]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.02}
          color={pupil}
          roughness={0.1}
        />
      </mesh>
    </group>
  );
}
