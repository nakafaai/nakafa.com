import { RoundedBox } from "@react-three/drei";
import { PLACES } from "@repo/design-system/components/contents/biology/equipment/places";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  Color,
  DoubleSide,
  LatheGeometry,
  MeshPhysicalMaterial,
  Vector2,
  Vector3,
} from "three";

/** How high the coat hooks stand on the side wall, in metres. */
export const HOOK_HEIGHT = 1.8;

/** The hooks along the rail, one for the coat and one for the goggles, by where they stand along the wall. */
const HOOKS = [PLACES.labCoat.base[2], PLACES.goggles.base[2]] as const;

/** Cotton drill: matte, with the soft sheen woven cloth catches at a grazing angle. */
function useCloth(color: string) {
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color,
        roughness: 0.88,
        sheen: 1,
        sheenColor: new Color(color),
        sheenRoughness: 0.6,
        side: DoubleSide,
      }),
    [color]
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

/**
 * The coat's body, turned round its length and flattened to hang against the
 * wall: wider at the hem, taken in at the waist, square at the shoulders and
 * gathered to the collar, with soft folds that deepen towards the hem.
 */
function createCoat() {
  const outline = Arr.map(
    [
      [0.25, 0],
      [0.235, 0.25],
      [0.22, 0.5],
      [0.228, 0.75],
      [0.222, 0.9],
      [0.12, 0.955],
      [0.065, 0.975],
    ] as const,
    ([radius, height]) => new Vector2(radius, height)
  );
  const body = new LatheGeometry(outline, 72);
  const position = body.getAttribute("position");
  for (const index of Arr.range(0, position.count - 1)) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const angle = Math.atan2(x, z);
    const fold =
      1 + 0.045 * Math.sin(angle * 9 + y * 4) * Math.max(0, 1 - y / 0.85);
    position.setXYZ(index, x * fold * 0.2, y, z * fold);
  }
  body.computeVertexNormals();
  return body;
}

/** One sleeve, hanging from the shoulder down the coat's side, at `side` (-1 or 1) along the wall. */
function sleeve(side: number) {
  return new CatmullRomCurve3([
    new Vector3(0.004, 0.88, side * 0.24),
    new Vector3(0.012, 0.7, side * 0.262),
    new Vector3(0.016, 0.45, side * 0.266),
    new Vector3(0.012, 0.3, side * 0.262),
  ]);
}

/**
 * The hook rail on the side wall, a white cotton lab coat hanging from its
 * collar loop, knee length and buttoned down the front, with its sleeves
 * and two pockets.
 */
export function LabCoat() {
  const cloth = useCloth(LABORATORY_COLORS.coat);
  const body = useMemo(createCoat, []);
  useEffect(() => () => body.dispose(), [body]);
  const sleeves = useMemo(
    () => Arr.map([-1, 1] as const, (side) => ({ curve: sleeve(side), side })),
    []
  );
  const { base } = PLACES.labCoat;
  return (
    <group>
      <RoundedBox
        args={[0.02, 0.07, 0.75]}
        castShadow
        position={[
          base[0] - 0.045,
          HOOK_HEIGHT + 0.01,
          (HOOKS[0] + HOOKS[1]) / 2,
        ]}
        radius={0.004}
      >
        <meshStandardMaterial color={LABORATORY_COLORS.wood} roughness={0.6} />
      </RoundedBox>
      {Arr.map(HOOKS, (z) => (
        <group key={z} position={[base[0] - 0.035, HOOK_HEIGHT, z]}>
          <mesh
            castShadow
            position={[0.025, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.004, 0.004, 0.05, 12]} />
            <MetalMaterial color={LABORATORY_COLORS.hook} roughness={0.3} />
          </mesh>
          <mesh castShadow position={[0.05, 0.012, 0]}>
            <sphereGeometry args={[0.0065, 16, 12]} />
            <MetalMaterial color={LABORATORY_COLORS.hook} roughness={0.3} />
          </mesh>
        </group>
      ))}
      <group position={base}>
        <mesh castShadow geometry={body} material={cloth} receiveShadow />
        <mesh castShadow material={cloth} position={[0, 0.99, 0]}>
          <torusGeometry args={[0.02, 0.003, 8, 24]} />
        </mesh>
        {Arr.map(sleeves, (each) => (
          <mesh castShadow key={each.side} material={cloth}>
            <tubeGeometry args={[each.curve, 24, 0.045, 18, false]} />
          </mesh>
        ))}
        {Arr.map(Arr.range(0, 4), (index) => (
          <mesh
            key={index}
            position={[0.049, 0.32 + index * 0.13, 0.012]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.007, 0.007, 0.004, 16]} />
            <meshStandardMaterial
              color={LABORATORY_COLORS.button}
              roughness={0.4}
            />
          </mesh>
        ))}
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            castShadow
            key={side}
            material={cloth}
            position={[0.049, 0.36, side * 0.12]}
          >
            <boxGeometry args={[0.003, 0.16, 0.15]} />
          </mesh>
        ))}
        <mesh position={[0.046, 0.6, 0]}>
          <boxGeometry args={[0.002, 0.6, 0.003]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.coatShadow}
            roughness={0.9}
          />
        </mesh>
      </group>
    </group>
  );
}
