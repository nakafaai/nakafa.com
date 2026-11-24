import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  Monomer,
  Polysaccharide,
  Reaction,
  Scale,
  Sugar,
} from "@repo/design-system/components/contents/biology/sugar/polymer";
import {
  chainNodes,
  monomersOf,
} from "@repo/design-system/components/contents/biology/sugar/polymer";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { ATOM_COLORS } from "@repo/design-system/lib/material/atom";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo, useRef, useState } from "react";
import { BufferGeometry, Vector3 } from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.9, 2.25];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.56, 0];

/**
 * 3D carbohydrate workbench: pair scale animates condensation and hydrolysis
 * between two monosaccharide rings with a glycosidic oxygen bridge and water
 * molecule; chain scale renders starch helix, branched glycogen, or parallel
 * H-bonded cellulose chains.
 */
export function SugarScene({
  bondLabel,
  monomerNames,
  polysaccharide,
  reaction,
  scale,
  sugar,
  units,
}: {
  readonly bondLabel: string;
  readonly monomerNames: Readonly<Record<Monomer, string>>;
  readonly polysaccharide: Polysaccharide;
  readonly reaction: Reaction;
  readonly scale: Scale;
  readonly sugar: Sugar;
  readonly units: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const clock = useRef(0);
  const [phase, setPhase] = useState(reaction === "condensation" ? 1 : 0);

  useEffect(() => {
    setPhase(reaction === "condensation" ? 1 : 0);
    clock.current = 0;
  }, [reaction]);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current += simulationStep(delta);
    const wave = (1 - Math.cos(clock.current * 1.4)) / 2;
    setPhase(reaction === "condensation" ? wave : 1 - wave);
  });

  const [leftMonomer, rightMonomer] = monomersOf(sugar);
  const nodes = useMemo(
    () => chainNodes(polysaccharide, units),
    [polysaccharide, units]
  );

  const backboneGeo = useMemo(() => {
    const pts = Arr.flatMap(nodes, (a, i) => {
      const b = nodes[i + 1];
      return b === undefined || a.row !== b.row
        ? []
        : [
            new Vector3(a.position[0], a.position[1], a.position[2]),
            new Vector3(b.position[0], b.position[1], b.position[2]),
          ];
    });
    const geometry = new BufferGeometry();
    geometry.setFromPoints(pts);
    return geometry;
  }, [nodes]);

  const celluloseCrossGeo = useMemo(() => {
    const half = Math.ceil(nodes.length / 2);
    const pts =
      polysaccharide === "cellulose"
        ? Arr.flatMap(Arr.take(nodes, half), (top, i) => {
            const bottom = nodes[i + half];
            return bottom === undefined
              ? []
              : [
                  new Vector3(
                    top.position[0],
                    top.position[1],
                    top.position[2]
                  ),
                  new Vector3(
                    bottom.position[0],
                    bottom.position[1],
                    bottom.position[2]
                  ),
                ];
          })
        : [];
    const geometry = new BufferGeometry();
    geometry.setFromPoints(pts);
    return geometry;
  }, [nodes, polysaccharide]);

  useEffect(
    () => () => {
      backboneGeo.dispose();
      celluloseCrossGeo.dispose();
    },
    [backboneGeo, celluloseCrossGeo]
  );

  const sep = 0.34 + (1 - phase) * 0.24;
  const waterY = 0.22 + (1 - phase) * 0.32;

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

      {scale === "pair" ? (
        <group>
          <SugarRing monomer={leftMonomer} position={[-sep, 0.62, 0]} />
          <SugarRing monomer={rightMonomer} position={[sep, 0.62, 0]} />

          {/* Glycosidic -O- bridge visible when joined */}
          {phase > 0.35 && (
            <group position={[0, 0.62, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.024, 0.024, sep * 1.1, 12]} />
                <meshStandardMaterial color={PLOT_COLORS.teal} />
              </mesh>
              <mesh castShadow>
                <sphereGeometry args={[0.056, 18, 18]} />
                <meshStandardMaterial color={ATOM_COLORS.cpkOxygen} />
              </mesh>
              <ThreeLabel
                anchorY="bottom"
                color={ink}
                gap={0.08}
                position={[0, 0.08, 0]}
              >
                {bondLabel}
              </ThreeLabel>
            </group>
          )}

          {/* Water molecule released during condensation / entering during hydrolysis */}
          <group position={[0, waterY, 0.14]}>
            <mesh castShadow>
              <sphereGeometry args={[0.048, 16, 16]} />
              <meshStandardMaterial color={ATOM_COLORS.cpkOxygen} />
            </mesh>
            <mesh position={[-0.055, -0.036, 0]}>
              <sphereGeometry args={[0.03, 12, 12]} />
              <meshStandardMaterial color={ATOM_COLORS.cpkHydrogen} />
            </mesh>
            <mesh position={[0.055, -0.036, 0]}>
              <sphereGeometry args={[0.03, 12, 12]} />
              <meshStandardMaterial color={ATOM_COLORS.cpkHydrogen} />
            </mesh>
          </group>

          <ThreeLabel
            anchorY="top"
            color={ink}
            gap={0.04}
            position={[-sep, 0.34, 0]}
          >
            {monomerNames[leftMonomer]}
          </ThreeLabel>
          <ThreeLabel
            anchorY="top"
            color={ink}
            gap={0.04}
            position={[sep, 0.34, 0]}
          >
            {monomerNames[rightMonomer]}
          </ThreeLabel>
        </group>
      ) : (
        <group>
          {Arr.map(nodes, (node) => {
            let color: string = BIOLOGY_COLORS.glucose;
            if (node.branch) {
              color = PLOT_COLORS.amber;
            } else if (node.row === 1) {
              color = PLOT_COLORS.teal;
            }
            return (
              <mesh
                castShadow
                key={node.id}
                position={node.position}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.075, 0.075, 0.036, 6]} />
                <meshStandardMaterial color={color} roughness={0.45} />
              </mesh>
            );
          })}
          <lineSegments geometry={backboneGeo}>
            <lineBasicMaterial color={PLOT_COLORS.orange} />
          </lineSegments>
          {polysaccharide === "cellulose" && (
            <lineSegments geometry={celluloseCrossGeo}>
              <lineBasicMaterial color={PLOT_COLORS.teal} />
            </lineSegments>
          )}
        </group>
      )}
    </group>
  );
}

/** Monosaccharide ring (hexose 6-sided for glucose/galactose, pentose 5-sided for fructose). */
function SugarRing({
  monomer,
  position,
}: {
  readonly monomer: Monomer;
  readonly position: readonly [number, number, number];
}) {
  const sides = monomer === "fructose" ? 5 : 6;
  const color = Match.value(monomer).pipe(
    Match.when("glucose", () => BIOLOGY_COLORS.glucose),
    Match.when("fructose", () => PLOT_COLORS.amber),
    Match.when("galactose", () => PLOT_COLORS.violet),
    Match.exhaustive
  );

  return (
    <mesh castShadow position={position} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.2, 0.2, 0.05, sides]} />
      <meshStandardMaterial color={color} roughness={0.45} />
    </mesh>
  );
}
