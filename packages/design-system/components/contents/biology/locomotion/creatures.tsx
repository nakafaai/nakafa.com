import { useGLTF } from "@react-three/drei";
import { CC0_BARRAMUNDI_FISH_ASSET } from "@repo/design-system/components/contents/biology/assets";
import { prepareFaunaScene } from "@repo/design-system/components/contents/biology/fauna";
import type { LocomotionMuscle } from "@repo/design-system/components/contents/biology/locomotion/model";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  Color,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  Vector2,
} from "three";

const WORM_RING_COUNT = 34;

/** Sculpted continuous peristaltic earthworm body (34 annular rings + clitellum saddle + moist cuticle). */
export function EarthwormOrganism({
  elongated,
}: {
  readonly elongated: boolean;
}) {
  const { bodyGeo, chaetaeOffsets } = useMemo(() => {
    const length = elongated ? 1.56 : 1.32;
    const steps = WORM_RING_COUNT * 4;
    const pts = Arr.map(Arr.range(0, steps), (step) => {
      const t = step / steps;
      const x = (t - 0.5) * length;
      const endTaper = Math.sin(t * Math.PI) ** 0.38;
      const wavePhase = t * Math.PI * 4 + (elongated ? 0 : Math.PI);
      const wave = 1 + 0.24 * Math.cos(wavePhase);
      const ringGroove =
        1 - 0.08 * Math.abs(Math.sin(t * Math.PI * WORM_RING_COUNT));
      const clitellum = 1 + 0.16 * Math.exp(-(((t - 0.72) / 0.055) ** 2));
      const radius = Math.max(
        0.004,
        0.086 * endTaper * wave * ringGroove * clitellum
      );
      return new Vector2(radius, x);
    });

    const geo = new LatheGeometry(pts, 28);
    geo.rotateZ(-Math.PI / 2);

    const pos = geo.getAttribute("position");
    const colors = new Float32Array(pos.count * 3);
    const bodyCol = new Color(SKELETON_COLORS.wormBody);
    const grooveCol = new Color(SKELETON_COLORS.wormCuticle);
    const clitCol = new Color(SKELETON_COLORS.wormClitellum);
    const activeCol = new Color(SKELETON_COLORS.muscleContract);
    const tmp = new Color();

    for (let i = 0; i < pos.count; i += 1) {
      const vx = pos.getX(i);
      const t = Math.min(1, Math.max(0, vx / length + 0.5));
      const ringFactor = Math.abs(Math.sin(t * Math.PI * WORM_RING_COUNT));
      const clitMask = Math.exp(-(((t - 0.72) / 0.055) ** 2));
      const waveCos = Math.cos(t * Math.PI * 4 + (elongated ? 0 : Math.PI));
      const bulgeHighlight = Math.max(0, waveCos);
      tmp
        .copy(bodyCol)
        .lerp(grooveCol, ringFactor * 0.36)
        .lerp(activeCol, bulgeHighlight * 0.26)
        .lerp(clitCol, clitMask * 0.75);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const bristles = Arr.filter(
      Arr.makeBy(12, (idx) => {
        const t = 0.14 + (idx / 11) * 0.72;
        const waveCos = Math.cos(t * Math.PI * 4 + (elongated ? 0 : Math.PI));
        return { anchored: waveCos > 0.15, x: (t - 0.5) * length };
      }),
      (item) => item.anchored
    );

    return { bodyGeo: geo, chaetaeOffsets: bristles };
  }, [elongated]);

  useEffect(() => () => bodyGeo.dispose(), [bodyGeo]);

  return (
    <group>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[2.55, 0.1, 1.38]} />
        <SurfaceMaterial
          bump={0.95}
          color={SKELETON_COLORS.soil}
          repeat={[3, 2]}
          roughness={0.94}
          surface="concrete"
        />
      </mesh>
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[2.52, 0.06, 1.35]} />
        <meshStandardMaterial
          color={SKELETON_COLORS.soilDark}
          roughness={0.96}
        />
      </mesh>

      <group position={[0, 0.16, 0]}>
        <mesh castShadow geometry={bodyGeo} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.82}
            clearcoatRoughness={0.14}
            roughness={0.34}
            vertexColors
          />
        </mesh>

        {Arr.map(chaetaeOffsets, (b) => (
          <group key={`chaeta-${b.x.toFixed(3)}`} position={[b.x, -0.09, 0]}>
            <mesh position={[0, 0, 0.036]} rotation={[0.25, 0, -0.18]}>
              <coneGeometry args={[0.011, 0.068, 6]} />
              <meshStandardMaterial
                color={SKELETON_COLORS.wormChaetae}
                roughness={0.72}
              />
            </mesh>
            <mesh position={[0, 0, -0.036]} rotation={[-0.25, 0, -0.18]}>
              <coneGeometry args={[0.011, 0.068, 6]} />
              <meshStandardMaterial
                color={SKELETON_COLORS.wormChaetae}
                roughness={0.72}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Real Khronos CC0 photorealistic Barramundi fish swimming with W-shaped lateral myotome overlay. */
export function BarramundiFishOrganism({
  activeMuscle,
}: {
  readonly activeMuscle: LocomotionMuscle;
}) {
  const { scene } = useGLTF(CC0_BARRAMUNDI_FISH_ASSET.path);
  const fish = useMemo(
    () =>
      prepareFaunaScene(scene, {
        groundBottom: false,
        targetExtent: 1.56,
      }),
    [scene]
  );

  const myotomeGeo = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-0.28, 0.09);
    shape.lineTo(-0.14, 0.12);
    shape.lineTo(0, 0.06);
    shape.lineTo(0.14, 0.11);
    shape.lineTo(0.24, 0.03);
    shape.lineTo(0.14, -0.05);
    shape.lineTo(0, -0.01);
    shape.lineTo(-0.14, -0.08);
    shape.lineTo(-0.28, -0.03);
    shape.closePath();
    return new ExtrudeGeometry(shape, {
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.008,
      bevelThickness: 0.008,
      depth: 0.014,
    });
  }, []);

  useEffect(() => () => myotomeGeo.dispose(), [myotomeGeo]);

  const bend = activeMuscle === "left" ? 0.22 : -0.22;

  return (
    <group>
      <mesh position={[0, 0.46, 0]}>
        <boxGeometry args={[2.55, 0.92, 1.38]} />
        <meshPhysicalMaterial
          clearcoat={0.9}
          clearcoatRoughness={0.08}
          color={SKELETON_COLORS.waterMedium}
          depthWrite={false}
          opacity={0.14}
          roughness={0.1}
          transparent
        />
      </mesh>

      <group
        position={[0, 0.46, 0]}
        rotation={[0, Math.PI / 2 + bend, bend * 0.18]}
      >
        <primitive object={fish} />

        <mesh
          geometry={myotomeGeo}
          position={[0.108, 0.01, 0.03]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <meshPhysicalMaterial
            color={
              activeMuscle === "left"
                ? SKELETON_COLORS.muscleContract
                : SKELETON_COLORS.muscleRelax
            }
            opacity={activeMuscle === "left" ? 0.72 : 0.28}
            roughness={0.42}
            transparent
          />
        </mesh>
        <mesh
          geometry={myotomeGeo}
          position={[-0.122, 0.01, 0.03]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <meshPhysicalMaterial
            color={
              activeMuscle === "right"
                ? SKELETON_COLORS.muscleContract
                : SKELETON_COLORS.muscleRelax
            }
            opacity={activeMuscle === "right" ? 0.72 : 0.28}
            roughness={0.42}
            transparent
          />
        </mesh>
      </group>
    </group>
  );
}

useGLTF.preload(CC0_BARRAMUNDI_FISH_ASSET.path);
