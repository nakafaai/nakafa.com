import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { Level } from "@repo/design-system/components/contents/biology/chromosome/packing";
import {
  fibreBeads,
  helixRungs,
  nucleosomeCenters,
} from "@repo/design-system/components/contents/biology/chromosome/packing";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { BufferGeometry, Vector3 } from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.82, 2.2];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.56, 0];

/**
 * 3D hierarchical DNA packaging scene zooming from a single nucleotide to
 * double helix, histone nucleosomes, 30 nm chromatin fibre, and X-shaped
 * metaphase chromosome with sister chromatids joined at the centromere.
 */
export function ChromosomeScene({
  level,
  parts,
}: {
  readonly level: Level;
  readonly parts: Readonly<
    Record<
      "phosphate" | "sugar" | "base" | "histone" | "chromatid" | "centromere",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const rootRef = useRef<Group>(null);
  const clock = useRef(0);

  const rungs = useMemo(() => helixRungs(16), []);
  const nucleosomes = useMemo(() => nucleosomeCenters(), []);
  const solenoid = useMemo(() => fibreBeads(24), []);

  const helixGeo = useMemo(() => {
    const pts = Arr.flatMap(rungs, (curr, i) => {
      const next = rungs[i + 1];
      const base = [
        new Vector3(curr.left[0], curr.left[1], curr.left[2]),
        new Vector3(curr.right[0], curr.right[1], curr.right[2]),
      ];
      if (next === undefined) {
        return base;
      }
      return Arr.appendAll(base, [
        new Vector3(curr.left[0], curr.left[1], curr.left[2]),
        new Vector3(next.left[0], next.left[1], next.left[2]),
        new Vector3(curr.right[0], curr.right[1], curr.right[2]),
        new Vector3(next.right[0], next.right[1], next.right[2]),
      ]);
    });
    const geometry = new BufferGeometry();
    geometry.setFromPoints(pts);
    return geometry;
  }, [rungs]);

  const linkerGeo = useMemo(() => {
    const pts = Arr.map(nucleosomes, ([x, y, z]) => new Vector3(x, y, z));
    const geometry = new BufferGeometry();
    geometry.setFromPoints(pts);
    return geometry;
  }, [nucleosomes]);

  useEffect(
    () => () => {
      helixGeo.dispose();
      linkerGeo.dispose();
    },
    [helixGeo, linkerGeo]
  );

  useFrame((_, delta) => {
    if (!playing || rootRef.current === null) {
      return;
    }
    clock.current += simulationStep(delta);
    rootRef.current.rotation.y = Math.sin(clock.current * 0.75) * 0.45;
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
        {Match.value(level).pipe(
          Match.when("nucleotide", () => (
            <group>
              {/* Phosphate circle, pentose deoxyribose, and nitrogenous base */}
              <mesh castShadow position={[-0.46, 0.74, 0]}>
                <sphereGeometry args={[0.13, 22, 22]} />
                <meshStandardMaterial color={CELL_COLORS.phosphateNew} />
              </mesh>
              <mesh
                castShadow
                position={[0, 0.56, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.2, 0.2, 0.06, 5]} />
                <meshStandardMaterial color={CELL_COLORS.deoxyribose} />
              </mesh>
              <mesh castShadow position={[0.48, 0.62, 0]}>
                <boxGeometry args={[0.38, 0.2, 0.07]} />
                <meshStandardMaterial color={CELL_COLORS.adenine} />
              </mesh>
              <ThreeLabel
                anchorY="bottom"
                color={ink}
                gap={0.05}
                position={[-0.46, 0.92, 0]}
              >
                {parts.phosphate}
              </ThreeLabel>
              <ThreeLabel
                anchorY="top"
                color={ink}
                gap={0.05}
                position={[0, 0.3, 0]}
              >
                {parts.sugar}
              </ThreeLabel>
              <ThreeLabel
                anchorY="bottom"
                color={ink}
                gap={0.05}
                position={[0.48, 0.78, 0]}
              >
                {parts.base}
              </ThreeLabel>
            </group>
          )),
          Match.when("helix", () => (
            <group>
              {Arr.map(rungs, (rung) => (
                <group key={rung.id}>
                  <mesh castShadow position={rung.left}>
                    <sphereGeometry args={[0.04, 12, 12]} />
                    <meshStandardMaterial color={CELL_COLORS.phosphateNew} />
                  </mesh>
                  <mesh castShadow position={rung.right}>
                    <sphereGeometry args={[0.04, 12, 12]} />
                    <meshStandardMaterial color={CELL_COLORS.thymine} />
                  </mesh>
                </group>
              ))}
              <lineSegments geometry={helixGeo}>
                <lineBasicMaterial color={CELL_COLORS.adenine} />
              </lineSegments>
              <ThreeLabel
                anchorY="bottom"
                color={ink}
                gap={0.05}
                position={[0, 0.88, 0]}
              >
                {parts.base}
              </ThreeLabel>
            </group>
          )),
          Match.when("nucleosome", () => (
            <group>
              {Arr.map(nucleosomes, ([x, y, z]) => (
                <group key={`${x}-${y}-${z}`} position={[x, y, z]}>
                  {/* Histone octamer core */}
                  <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.13, 0.13, 0.14, 22]} />
                    <meshStandardMaterial
                      color={CELL_COLORS.nucleus}
                      roughness={0.45}
                    />
                  </mesh>
                  {/* DNA double-wrap rings around the histone spool */}
                  <mesh position={[0, 0, 0.035]}>
                    <torusGeometry args={[0.145, 0.022, 10, 26]} />
                    <meshStandardMaterial color={PLOT_COLORS.teal} />
                  </mesh>
                  <mesh position={[0, 0, -0.035]}>
                    <torusGeometry args={[0.145, 0.022, 10, 26]} />
                    <meshStandardMaterial color={PLOT_COLORS.teal} />
                  </mesh>
                </group>
              ))}
              <lineSegments geometry={linkerGeo}>
                <lineBasicMaterial color={PLOT_COLORS.teal} />
              </lineSegments>
              <ThreeLabel
                anchorY="bottom"
                color={ink}
                gap={0.05}
                position={[0.22, 0.84, 0]}
              >
                {parts.histone}
              </ThreeLabel>
            </group>
          )),
          Match.when("fibre", () => (
            <group>
              {Arr.map(solenoid, ([x, y, z]) => (
                <mesh castShadow key={`${x}-${y}-${z}`} position={[x, y, z]}>
                  <sphereGeometry args={[0.095, 16, 16]} />
                  <meshStandardMaterial
                    color={CELL_COLORS.chromatin}
                    roughness={0.45}
                  />
                </mesh>
              ))}
              <ThreeLabel
                anchorY="bottom"
                color={ink}
                gap={0.05}
                position={[0, 0.9, 0]}
              >
                {parts.histone}
              </ThreeLabel>
            </group>
          )),
          Match.when("chromosome", () => (
            <group position={[0, 0.58, 0]}>
              {/* X-shaped pair of sister chromatids joined at the centromere */}
              <mesh castShadow rotation={[0, 0, 0.28]}>
                <capsuleGeometry args={[0.105, 0.72, 12, 22]} />
                <meshStandardMaterial
                  color={CELL_COLORS.nucleus}
                  roughness={0.4}
                />
              </mesh>
              <mesh castShadow rotation={[0, 0, -0.28]}>
                <capsuleGeometry args={[0.105, 0.72, 12, 22]} />
                <meshStandardMaterial
                  color={CELL_COLORS.nucleus}
                  roughness={0.4}
                />
              </mesh>
              <mesh castShadow>
                <sphereGeometry args={[0.115, 22, 22]} />
                <meshStandardMaterial
                  color={PLOT_COLORS.amber}
                  roughness={0.35}
                />
              </mesh>
              <ThreeLabel
                anchorX="left"
                color={ink}
                gap={0.04}
                position={[0.26, 0.32, 0]}
              >
                {parts.chromatid}
              </ThreeLabel>
              <ThreeLabel
                anchorX="left"
                color={ink}
                gap={0.04}
                position={[0.18, 0, 0]}
              >
                {parts.centromere}
              </ThreeLabel>
            </group>
          )),
          Match.exhaustive
        )}
      </group>
    </group>
  );
}
