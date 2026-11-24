import { RoundedBox } from "@react-three/drei";
import { HOOK_HEIGHT } from "@repo/design-system/components/contents/biology/equipment/coat";
import { PLACES } from "@repo/design-system/components/contents/biology/equipment/places";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  PlaneGeometry,
  Vector3,
} from "three";

/**
 * Indirect-vent safety goggles hanging by their strap from the second hook:
 * a soft grey frame that seals round the eyes and a clear polycarbonate lens,
 * closed at the sides, with four capped vents on top.
 */
export function Goggles() {
  const { base, size } = PLACES.goggles;
  const strap = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0.002, size[1] / 2, -0.072),
        new Vector3(0.012, size[1] / 2 + 0.09, -0.04),
        new Vector3(0.045, HOOK_HEIGHT - base[1] + 0.006, 0),
        new Vector3(0.012, size[1] / 2 + 0.09, 0.04),
        new Vector3(0.002, size[1] / 2, 0.072),
      ]),
    [base, size]
  );
  return (
    <group position={base}>
      <mesh castShadow>
        <tubeGeometry args={[strap, 40, 0.0028, 8, false]} />
        <meshStandardMaterial color={LABORATORY_COLORS.strap} roughness={0.8} />
      </mesh>
      <group position={[-0.052, size[1] / 2, 0]}>
        <mesh castShadow>
          <cylinderGeometry
            args={[
              0.09,
              0.09,
              size[1] - 0.012,
              40,
              1,
              true,
              Math.PI / 2 - 0.95,
              1.9,
            ]}
          />
          <GlassMaterial color={LABORATORY_COLORS.polystyrene} opacity={0.32} />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            castShadow
            key={side}
            position={[0, side * (size[1] / 2 - 0.004), 0]}
          >
            <cylinderGeometry
              args={[
                0.0905,
                0.0905,
                0.008,
                40,
                1,
                true,
                Math.PI / 2 - 0.97,
                1.94,
              ]}
            />
            <meshPhysicalMaterial
              color={LABORATORY_COLORS.goggleFrame}
              roughness={0.55}
              side={DoubleSide}
            />
          </mesh>
        ))}
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            castShadow
            key={side}
            position={[Math.cos(0.96) * 0.09, 0, side * Math.sin(0.96) * 0.09]}
            rotation={[0, -side * 0.96, 0]}
          >
            <boxGeometry args={[0.012, size[1], 0.006]} />
            <meshPhysicalMaterial
              color={LABORATORY_COLORS.goggleFrame}
              roughness={0.55}
            />
          </mesh>
        ))}
        {Arr.map([-0.45, -0.15, 0.15, 0.45] as const, (angle) => (
          <mesh
            castShadow
            key={angle}
            position={[
              Math.cos(angle) * 0.09,
              size[1] / 2 + 0.002,
              Math.sin(angle) * 0.09,
            ]}
          >
            <cylinderGeometry args={[0.005, 0.006, 0.004, 14]} />
            <meshStandardMaterial
              color={LABORATORY_COLORS.goggleFrame}
              roughness={0.5}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** A box of 100 blue nitrile gloves on the bench, one glove pulled half out of its slot. */
export function Gloves() {
  const nitrile = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: 0.3,
        color: LABORATORY_COLORS.nitrile,
        roughness: 0.55,
        sheen: 0.4,
        sheenColor: new Color(LABORATORY_COLORS.nitrile),
      }),
    []
  );
  useEffect(() => () => nitrile.dispose(), [nitrile]);
  const { base, size } = PLACES.gloves;
  const fingers = Arr.map(Arr.range(0, 3), (index) => ({
    key: index,
    lean: 0.5 + index * 0.18,
    z: -0.018 + index * 0.012,
  }));
  return (
    <group position={base}>
      <RoundedBox
        args={[size[0], size[1], size[2]]}
        castShadow
        position={[0, size[1] / 2, 0]}
        radius={0.003}
        receiveShadow
      >
        <meshStandardMaterial color={LABORATORY_COLORS.box} roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, size[1] * 0.45, size[2] / 2 + 0.0005]}>
        <planeGeometry args={[size[0] - 0.01, 0.018]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.boxBand}
          roughness={0.6}
        />
      </mesh>
      <mesh
        position={[0, size[1] + 0.0005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[1, 0.32, 1]}
      >
        <circleGeometry args={[0.05, 40]} />
        <meshBasicMaterial color={LABORATORY_COLORS.strap} />
      </mesh>
      <mesh
        castShadow
        material={nitrile}
        position={[0.004, size[1] + 0.012, 0]}
        scale={[0.04, 0.018, 0.03]}
      >
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>
      {Arr.map(fingers, (finger) => (
        <mesh
          castShadow
          key={finger.key}
          material={nitrile}
          position={[0.038, size[1] + 0.016, finger.z]}
          rotation={[0, 0, -finger.lean - Math.PI / 2]}
        >
          <capsuleGeometry args={[0.0065, 0.035, 6, 14]} />
        </mesh>
      ))}
    </group>
  );
}

/** A 175 by 95 mm three-ply mask, pleated three times across, as a flat sheet with its folds raised. */
function createMask() {
  const sheet = new PlaneGeometry(0.175, 0.095, 24, 36);
  sheet.rotateX(-Math.PI / 2);
  const position = sheet.getAttribute("position");
  for (const index of Arr.range(0, position.count - 1)) {
    const z = position.getZ(index);
    const pleat = Math.abs((((z / 0.095 + 0.5) * 6) % 2) - 1);
    position.setY(index, 0.0012 + 0.0018 * pleat);
  }
  sheet.computeVertexNormals();
  return sheet;
}

/** The mask's ear loops, flat on the bench beyond its short ends. */
function earLoop(side: number) {
  return new CatmullRomCurve3(
    Arr.map(Arr.range(0, 10), (step) => {
      const angle = (step / 10) * Math.PI;
      return new Vector3(
        side * (0.0875 + Math.sin(angle) * 0.032),
        0.0009,
        Math.cos(angle) * 0.034
      );
    })
  );
}

/** A face mask lying on the bench in front of its box of fifty. */
export function Mask() {
  const sheet = useMemo(createMask, []);
  useEffect(() => () => sheet.dispose(), [sheet]);
  const loops = useMemo(
    () => Arr.map([-1, 1] as const, (side) => ({ curve: earLoop(side), side })),
    []
  );
  const { base } = PLACES.mask;
  return (
    <group>
      <group position={[base[0] - 0.02, base[1], base[2] - 0.18]}>
        <RoundedBox
          args={[0.19, 0.075, 0.1]}
          castShadow
          position={[0, 0.0375, 0]}
          radius={0.003}
          receiveShadow
        >
          <meshStandardMaterial color={LABORATORY_COLORS.box} roughness={0.7} />
        </RoundedBox>
        <mesh position={[0, 0.03, 0.0505]}>
          <planeGeometry args={[0.18, 0.02]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.mask}
            roughness={0.7}
          />
        </mesh>
        <mesh position={[0, 0.0755, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.12, 0.012]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.mask}
            roughness={0.85}
          />
        </mesh>
      </group>
      <group position={base} rotation={[0, 0.12, 0]}>
        <mesh castShadow geometry={sheet} receiveShadow>
          <meshStandardMaterial
            color={LABORATORY_COLORS.mask}
            roughness={0.9}
            side={DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0.0032, -0.044]}>
          <boxGeometry args={[0.1, 0.0012, 0.004]} />
          <meshStandardMaterial color={LABORATORY_COLORS.box} roughness={0.6} />
        </mesh>
        {Arr.map(loops, (loop) => (
          <mesh key={loop.side}>
            <tubeGeometry args={[loop.curve, 24, 0.0008, 6, false]} />
            <meshStandardMaterial
              color={LABORATORY_COLORS.box}
              roughness={0.7}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
