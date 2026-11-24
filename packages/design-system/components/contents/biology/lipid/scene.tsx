import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  Chain,
  Molecule,
  Scale,
} from "@repo/design-system/components/contents/biology/lipid/packing";
import {
  bilayerHeads,
  moleculeTails,
  tailPoints,
} from "@repo/design-system/components/contents/biology/lipid/packing";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { BufferGeometry, Vector3 } from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.78, 2.25];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.56, 0];

const DROPLET_OFFSETS: readonly (readonly [number, number, number])[] = [
  [-0.14, 0.56, 0.08],
  [0.14, 0.62, -0.06],
  [0, 0.44, -0.1],
  [-0.1, 0.72, -0.06],
  [0.12, 0.48, 0.12],
];

/**
 * 3D lipid architecture workbench: single-molecule view of glycerol, ester
 * bonds, phosphate head, and straight vs cis-kinked fatty acid tails, plus
 * water-scale hydrophobic oil droplet vs phospholipid bilayer self-assembly.
 */
export function LipidScene({
  chain,
  molecule,
  parts,
  scale,
}: {
  readonly chain: Chain;
  readonly molecule: Molecule;
  readonly parts: Readonly<
    Record<
      "glycerol" | "fatty" | "ester" | "phosphate" | "head" | "tail" | "kink",
      string
    >
  >;
  readonly scale: Scale;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const rootRef = useRef<Group>(null);
  const clock = useRef(0);

  const tails = useMemo(
    () => moleculeTails(molecule, chain),
    [chain, molecule]
  );
  const heads = useMemo(() => bilayerHeads(chain), [chain]);

  const tailGeo = useMemo(() => {
    const pts = Arr.flatMap(tails, (tail) =>
      Arr.flatMap(tail.points, (a, i) => {
        const b = tail.points[i + 1];
        return b === undefined
          ? []
          : [new Vector3(a[0], a[1], a[2]), new Vector3(b[0], b[1], b[2])];
      })
    );
    const geometry = new BufferGeometry();
    geometry.setFromPoints(pts);
    return geometry;
  }, [tails]);

  const bilayerTailGeo = useMemo(() => {
    const pts = Arr.flatMap(heads, (head) => {
      const dir: 1 | -1 = head.leaflet === 1 ? -1 : 1;
      const t1 = tailPoints(head.x - 0.03, head.y, head.z, false, dir);
      const t2 = tailPoints(
        head.x + 0.03,
        head.y,
        head.z,
        chain === "unsaturated",
        dir
      );
      return Arr.flatMap([t1, t2], (strand) =>
        Arr.flatMap(Arr.take(strand, 4), (a, i) => {
          const b = strand[i + 1];
          return b === undefined
            ? []
            : [new Vector3(a[0], a[1], a[2]), new Vector3(b[0], b[1], b[2])];
        })
      );
    });
    const geometry = new BufferGeometry();
    geometry.setFromPoints(pts);
    return geometry;
  }, [chain, heads]);

  useEffect(
    () => () => {
      tailGeo.dispose();
      bilayerTailGeo.dispose();
    },
    [bilayerTailGeo, tailGeo]
  );

  useFrame((_, delta) => {
    if (!playing || rootRef.current === null) {
      return;
    }
    clock.current += simulationStep(delta);
    const amp = chain === "unsaturated" ? 0.025 : 0.008;
    rootRef.current.position.y = Math.sin(clock.current * 2.6) * amp;
  });

  return (
    <group>
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={38}
      />

      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[2.1, 0.04, 1.0]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.worktop}
          roughness={0.65}
        />
      </mesh>

      <group ref={rootRef}>
        {scale === "molecule" ? (
          <group>
            {/* Glycerol backbone */}
            <mesh castShadow position={[0, 0.84, 0]}>
              <boxGeometry args={[0.58, 0.09, 0.1]} />
              <meshStandardMaterial color={PLOT_COLORS.teal} roughness={0.45} />
            </mesh>
            <ThreeLabel
              anchorX="right"
              color={ink}
              gap={0.05}
              position={[-0.34, 0.86, 0]}
            >
              {parts.glycerol}
            </ThreeLabel>

            {/* Phosphate hydrophilic head (phospholipid only) */}
            {molecule === "phospholipid" && (
              <group>
                <mesh castShadow position={[0, 1.04, 0]}>
                  <sphereGeometry args={[0.13, 24, 24]} />
                  <meshStandardMaterial
                    color={CELL_COLORS.phosphateNew}
                    roughness={0.35}
                  />
                </mesh>
                <ThreeLabel
                  anchorX="left"
                  color={ink}
                  gap={0.05}
                  position={[0.18, 1.06, 0]}
                >
                  {parts.phosphate}
                </ThreeLabel>
              </group>
            )}

            {/* Ester bonds & fatty acid hydrocarbon tails */}
            {Arr.map(tails, (tail) => {
              const top = tail.points[0];
              const kinkPt = tail.points[4];
              return (
                <group key={tail.id}>
                  {top !== undefined && (
                    <mesh castShadow position={[top[0], top[1] + 0.04, top[2]]}>
                      <sphereGeometry args={[0.042, 14, 14]} />
                      <meshStandardMaterial color={PLOT_COLORS.pink} />
                    </mesh>
                  )}
                  {Arr.map(tail.points, (pt, index) => (
                    <mesh castShadow key={`${tail.id}-${pt[1]}`} position={pt}>
                      <sphereGeometry args={[0.032, 12, 12]} />
                      <meshStandardMaterial
                        color={
                          tail.kinked && index === 4
                            ? PLOT_COLORS.orange
                            : BIOLOGY_COLORS.glucose
                        }
                      />
                    </mesh>
                  ))}
                  {tail.kinked && kinkPt !== undefined && (
                    <ThreeLabel
                      anchorX="left"
                      color={ink}
                      gap={0.05}
                      position={[kinkPt[0] + 0.08, kinkPt[1], 0]}
                    >
                      {parts.kink}
                    </ThreeLabel>
                  )}
                </group>
              );
            })}
            <lineSegments geometry={tailGeo}>
              <lineBasicMaterial color={BIOLOGY_COLORS.glucose} />
            </lineSegments>

            <ThreeLabel
              anchorX="left"
              color={ink}
              gap={0.04}
              position={[0.32, 0.76, 0]}
            >
              {parts.ester}
            </ThreeLabel>
            <ThreeLabel
              anchorX="right"
              color={ink}
              gap={0.04}
              position={[-0.32, 0.44, 0]}
            >
              {parts.fatty}
            </ThreeLabel>
          </group>
        ) : (
          <group>
            {/* Surrounding translucent water volume */}
            <mesh position={[0, 0.56, 0]}>
              <boxGeometry args={[1.85, 1.05, 0.65]} />
              <meshPhysicalMaterial
                color={LABORATORY_COLORS.water}
                opacity={0.22}
                roughness={0.15}
                transparent
              />
            </mesh>

            {molecule === "triglyceride" ? (
              <group>
                {/* Hydrophobic oil droplet in water */}
                <mesh castShadow position={[0, 0.56, 0]}>
                  <sphereGeometry
                    args={[chain === "saturated" ? 0.31 : 0.36, 28, 28]}
                  />
                  <meshStandardMaterial
                    color={BIOLOGY_COLORS.glucose}
                    opacity={0.62}
                    roughness={0.35}
                    transparent
                  />
                </mesh>
                {Arr.map(DROPLET_OFFSETS, ([x, y, z]) => (
                  <mesh key={`${x}-${y}-${z}`} position={[x, y, z]}>
                    <sphereGeometry args={[0.09, 16, 16]} />
                    <meshStandardMaterial
                      color={PLOT_COLORS.amber}
                      roughness={0.4}
                    />
                  </mesh>
                ))}
              </group>
            ) : (
              <group>
                {/* Phospholipid bilayer with hydrophilic heads outward and hydrophobic tails inward */}
                {Arr.map(heads, (head) => (
                  <mesh
                    castShadow
                    key={head.id}
                    position={[head.x, head.y, head.z]}
                  >
                    <sphereGeometry args={[0.068, 16, 16]} />
                    <meshStandardMaterial
                      color={CELL_COLORS.phosphateNew}
                      roughness={0.35}
                    />
                  </mesh>
                ))}
                <lineSegments geometry={bilayerTailGeo}>
                  <lineBasicMaterial color={CELL_COLORS.lipidTail} />
                </lineSegments>
                <ThreeLabel
                  anchorX="left"
                  color={ink}
                  gap={0.04}
                  position={[0.78, 0.88, 0]}
                >
                  {parts.head}
                </ThreeLabel>
                <ThreeLabel
                  anchorX="left"
                  color={ink}
                  gap={0.04}
                  position={[0.78, 0.56, 0]}
                >
                  {parts.tail}
                </ThreeLabel>
              </group>
            )}
          </group>
        )}
      </group>
    </group>
  );
}
