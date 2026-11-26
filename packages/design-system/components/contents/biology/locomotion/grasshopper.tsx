import {
  useFoliageMaterial,
  useGrassClump,
} from "@repo/design-system/components/contents/biology/flora";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

const MEADOW_TUFTS = [
  { id: "nw", pos: [-0.95, 0.05, -0.32] as const, rot: 0 },
  { id: "sw", pos: [-0.75, 0.05, 0.36] as const, rot: 1.4 },
  { id: "ne", pos: [0.82, 0.05, -0.28] as const, rot: 2.8 },
  { id: "se", pos: [0.95, 0.05, 0.32] as const, rot: 4.2 },
] as const;

const TIBIAL_SPINES = [0.12, 0.205, 0.29, 0.375, 0.46] as const;

/** High-detail sculpted orthopteran grasshopper with articulated jumping femur, extensor cutaway & spined tibia. */
export function GrasshopperOrganism({
  kicking,
}: {
  readonly kicking: boolean;
}) {
  const grass = useGrassClump(42, 12);
  const foliageMat = useFoliageMaterial();

  const geos = useMemo(() => {
    const abdPts = Arr.map(Arr.range(0, 32), (s) => {
      const t = s / 32;
      const taper = Math.sin(t * Math.PI) ** 0.55;
      const ring = 1 - 0.06 * Math.abs(Math.sin(t * Math.PI * 8));
      return new Vector2(
        Math.max(0.005, 0.095 * taper * ring),
        (t - 0.5) * 0.62
      );
    });
    const abdomen = new LatheGeometry(abdPts, 24);
    abdomen.rotateZ(Math.PI / 2);

    const wingShape = new Shape();
    wingShape.moveTo(0, 0);
    wingShape.bezierCurveTo(0.2, 0.075, 0.52, 0.065, 0.72, 0.01);
    wingShape.bezierCurveTo(0.56, -0.055, 0.22, -0.06, 0, -0.02);
    wingShape.closePath();
    const wing = new ExtrudeGeometry(wingShape, {
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.004,
      bevelThickness: 0.004,
      depth: 0.01,
    });

    const femurGeo = new SphereGeometry(1, 24, 18);
    const fPos = femurGeo.getAttribute("position");
    for (let i = 0; i < fPos.count; i += 1) {
      const ux = fPos.getX(i);
      const uy = fPos.getY(i);
      const uz = fPos.getZ(i);
      const taper = 0.58 + 0.52 * (1 - (uy + 1) * 0.5) ** 0.65;
      fPos.setXYZ(i, ux * 0.078 * taper, uy * 0.28, uz * 0.048 * taper);
    }
    femurGeo.computeVertexNormals();

    const antenna = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(0.11, 0.09, 0.04),
        new Vector3(0.24, 0.14, 0.09),
        new Vector3(0.36, 0.12, 0.13),
      ]),
      14,
      0.008,
      6,
      false
    );

    const walkLeg = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(0.05, -0.07, 0.11),
        new Vector3(0.09, -0.19, 0.14),
        new Vector3(0.14, -0.2, 0.16),
      ]),
      12,
      0.013,
      7,
      false
    );

    return { abdomen, antenna, femurGeo, walkLeg, wing };
  }, []);

  useEffect(
    () => () => {
      geos.abdomen.dispose();
      geos.wing.dispose();
      geos.femurGeo.dispose();
      geos.antenna.dispose();
      geos.walkLeg.dispose();
    },
    [geos]
  );

  const femurAngle = kicking ? 0.45 : 0.72;
  const tibiaAngle = kicking ? 1.55 : 2.68;

  return (
    <group>
      <mesh position={[0, 0.025, 0]} receiveShadow>
        <boxGeometry args={[2.55, 0.07, 1.38]} />
        <SurfaceMaterial
          bump={0.7}
          color={SKELETON_COLORS.groundMeadow}
          repeat={[3, 2]}
          roughness={0.88}
          surface="concrete"
        />
      </mesh>
      {Arr.map(MEADOW_TUFTS, (tuft) => (
        <mesh
          castShadow
          geometry={grass}
          key={tuft.id}
          material={foliageMat}
          position={tuft.pos}
          rotation={[0, tuft.rot, 0]}
          scale={0.72}
        />
      ))}

      <group
        position={[kicking ? 0.14 : 0, kicking ? 0.56 : 0.28, 0]}
        rotation={[0, 0, kicking ? 0.24 : 0.04]}
      >
        <mesh
          castShadow
          geometry={geos.abdomen}
          position={[-0.26, -0.01, 0]}
          receiveShadow
        >
          <meshPhysicalMaterial
            clearcoat={0.55}
            clearcoatRoughness={0.28}
            color={SKELETON_COLORS.grasshopperBody}
            roughness={0.4}
          />
        </mesh>

        <mesh castShadow position={[0.12, 0.045, 0]} scale={[1.25, 0.92, 0.88]}>
          <sphereGeometry args={[0.115, 22, 16]} />
          <meshPhysicalMaterial
            clearcoat={0.62}
            clearcoatRoughness={0.22}
            color={SKELETON_COLORS.grasshopperExoskeleton}
            roughness={0.34}
          />
        </mesh>

        <group position={[0.29, 0.05, 0]} rotation={[0, 0, -0.18]}>
          <mesh castShadow scale={[0.82, 1.18, 0.78]}>
            <sphereGeometry args={[0.09, 20, 16]} />
            <meshPhysicalMaterial
              clearcoat={0.58}
              color={SKELETON_COLORS.grasshopperBody}
              roughness={0.38}
            />
          </mesh>
          {Arr.map([-1, 1] as const, (side) => (
            <group key={`eye-${side}`}>
              <mesh
                position={[0.025, 0.045, side * 0.062]}
                scale={[0.9, 1.3, 0.75]}
              >
                <sphereGeometry args={[0.032, 14, 12]} />
                <meshPhysicalMaterial
                  clearcoat={0.9}
                  color={SKELETON_COLORS.grasshopperEye}
                  roughness={0.14}
                />
              </mesh>
              <mesh
                castShadow
                geometry={geos.antenna}
                position={[0.045, 0.065, side * 0.03]}
                scale={[1, 1, side]}
              >
                <meshStandardMaterial
                  color={SKELETON_COLORS.grasshopperSpine}
                  roughness={0.5}
                />
              </mesh>
            </group>
          ))}
        </group>

        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            castShadow
            geometry={geos.wing}
            key={`wing-${side}`}
            position={[-0.6, 0.055, side * 0.068]}
            rotation={[side * 0.14, 0, -0.06]}
          >
            <meshPhysicalMaterial
              clearcoat={0.48}
              color={SKELETON_COLORS.grasshopperWing}
              opacity={0.86}
              roughness={0.34}
              transparent
            />
          </mesh>
        ))}

        {Arr.map([-1, 1] as const, (side) => (
          <group key={`walk-${side}`}>
            <mesh
              castShadow
              geometry={geos.walkLeg}
              position={[0.2, -0.03, side * 0.06]}
              scale={[0.9, 0.9, side]}
            >
              <meshStandardMaterial
                color={SKELETON_COLORS.grasshopperExoskeleton}
                roughness={0.44}
              />
            </mesh>
            <mesh
              castShadow
              geometry={geos.walkLeg}
              position={[0.08, -0.04, side * 0.07]}
              scale={[1, 1, side]}
            >
              <meshStandardMaterial
                color={SKELETON_COLORS.grasshopperExoskeleton}
                roughness={0.44}
              />
            </mesh>
          </group>
        ))}

        {Arr.map([1, -1] as const, (side) => (
          <group
            key={`hind-${side}`}
            position={[-0.02, -0.02, side * 0.12]}
            rotation={[0, 0, femurAngle]}
          >
            <mesh castShadow geometry={geos.femurGeo} position={[0, 0.24, 0]}>
              <meshPhysicalMaterial
                clearcoat={0.62}
                clearcoatRoughness={0.22}
                color={SKELETON_COLORS.grasshopperExoskeleton}
                roughness={0.35}
              />
            </mesh>

            {side === 1 ? (
              <mesh position={[0, 0.24, 0.034]} scale={[0.5, 1.55, 0.26]}>
                <sphereGeometry args={[0.072, 18, 14]} />
                <meshPhysicalMaterial
                  clearcoat={0.34}
                  color={
                    kicking
                      ? SKELETON_COLORS.muscleContract
                      : SKELETON_COLORS.muscleRelax
                  }
                  roughness={0.48}
                />
              </mesh>
            ) : null}

            <group position={[0, 0.48, 0]} rotation={[0, 0, tibiaAngle]}>
              <mesh castShadow position={[0, 0.27, 0]}>
                <cylinderGeometry args={[0.014, 0.022, 0.54, 10]} />
                <meshPhysicalMaterial
                  clearcoat={0.55}
                  color={SKELETON_COLORS.grasshopperExoskeleton}
                  roughness={0.38}
                />
              </mesh>
              {Arr.map(TIBIAL_SPINES, (sy) => (
                <mesh
                  key={`spine-${sy}`}
                  position={[0.024, sy, 0]}
                  rotation={[0, 0, -1.15]}
                >
                  <coneGeometry args={[0.008, 0.04, 5]} />
                  <meshStandardMaterial
                    color={SKELETON_COLORS.grasshopperSpine}
                    roughness={0.5}
                  />
                </mesh>
              ))}
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}
