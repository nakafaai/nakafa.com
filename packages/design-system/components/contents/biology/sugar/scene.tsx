import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  CovalentBond,
  MonosaccharideMolecule,
  WaterMolecule,
} from "@repo/design-system/components/contents/biology/sugar/molecules";
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
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { ATOM_COLORS } from "@repo/design-system/lib/material/atom";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef, useState } from "react";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.9, 2.38];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.56, 0];

/**
 * 3D carbohydrate workbench: pair scale animates condensation and hydrolysis
 * between two 3D CPK monosaccharide chair/envelope rings with a glycosidic
 * oxygen bridge and bent H2O; chain scale renders 3D starch, glycogen, or
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

  useVisualStop(() => {
    clock.current = 0;
    setPhase(reaction === "condensation" ? 1 : 0);
  });

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

  // 3D covalent glycosidic linkages along each polysaccharide row.
  const backboneLinks = useMemo(
    () =>
      Arr.flatMap(nodes, (a, i) => {
        const b = nodes[i + 1];
        if (b === undefined || a.row !== b.row) {
          return [];
        }
        return [
          {
            from: a.position,
            id: `bb-${a.id}-${b.id}`,
            mid: [
              (a.position[0] + b.position[0]) * 0.5,
              (a.position[1] + b.position[1]) * 0.5,
              (a.position[2] + b.position[2]) * 0.5,
            ] as const,
            to: b.position,
          },
        ];
      }),
    [nodes]
  );

  // Inter-chain hydrogen bonds bridging parallel cellulose fibrils.
  const celluloseCrossLinks = useMemo(() => {
    if (polysaccharide !== "cellulose") {
      return [];
    }
    const half = Math.ceil(nodes.length / 2);
    return Arr.flatMap(Arr.take(nodes, half), (top, i) => {
      const bottom = nodes[i + half];
      return bottom === undefined
        ? []
        : [{ from: top.position, id: `hb-${top.id}`, to: bottom.position }];
    });
  }, [nodes, polysaccharide]);

  const sep = 0.42 + (1 - phase) * 0.24;
  const waterY = 0.22 + (1 - phase) * 0.3;

  return (
    <group>
      <SimulationTicker running={playing} />
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={38}
      />

      {/* Laboratory stone bench */}
      <mesh position={[0, -0.025, 0]} receiveShadow>
        <boxGeometry args={[2.2, 0.05, 1.05]} />
        <SurfaceMaterial
          bump={0.22}
          color={LABORATORY_COLORS.cabinet}
          roughness={0.72}
          surface="concrete"
        />
      </mesh>

      {scale === "pair" ? (
        <group>
          <MonosaccharideMolecule
            monomer={leftMonomer}
            position={[-sep, 0.64, 0]}
          />
          <MonosaccharideMolecule
            monomer={rightMonomer}
            position={[sep, 0.64, 0]}
          />

          {/* 3D angled C-O-C glycosidic ether bridge visible when joined */}
          {phase > 0.35 ? (
            <group>
              <CovalentBond
                color={PLOT_COLORS.teal}
                from={[-sep + 0.19, 0.64, 0]}
                radius={0.018}
                to={[0, 0.68, 0.03]}
              />
              <CovalentBond
                color={PLOT_COLORS.teal}
                from={[0, 0.68, 0.03]}
                radius={0.018}
                to={[sep - 0.19, 0.64, 0]}
              />
              <mesh castShadow position={[0, 0.68, 0.03]}>
                <sphereGeometry args={[0.056, 22, 18]} />
                <meshPhysicalMaterial
                  clearcoat={0.82}
                  color={ATOM_COLORS.cpkOxygen}
                  roughness={0.2}
                />
              </mesh>
              <ThreeLabel
                anchorY="bottom"
                color={ink}
                gap={0.08}
                position={[0, 0.8, 0]}
              >
                {bondLabel}
              </ThreeLabel>
            </group>
          ) : null}

          <WaterMolecule position={[0, waterY, 0.18]} />

          <ThreeLabel
            anchorY="top"
            color={ink}
            gap={0.04}
            position={[-sep, 0.28, 0]}
          >
            {monomerNames[leftMonomer]}
          </ThreeLabel>
          <ThreeLabel
            anchorY="top"
            color={ink}
            gap={0.04}
            position={[sep, 0.28, 0]}
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
              <MonosaccharideMolecule
                compact
                key={node.id}
                monomer="glucose"
                position={node.position}
                tintColor={color}
              />
            );
          })}
          {Arr.map(backboneLinks, (link) => (
            <group key={link.id}>
              <CovalentBond
                color={PLOT_COLORS.orange}
                from={link.from}
                radius={0.011}
                to={link.to}
              />
              <mesh castShadow position={link.mid}>
                <sphereGeometry args={[0.026, 12, 10]} />
                <meshPhysicalMaterial
                  clearcoat={0.75}
                  color={ATOM_COLORS.cpkOxygen}
                  roughness={0.22}
                />
              </mesh>
            </group>
          ))}
          {Arr.map(celluloseCrossLinks, (hb) => (
            <CovalentBond
              color={PLOT_COLORS.teal}
              from={hb.from}
              key={hb.id}
              radius={0.008}
              to={hb.to}
            />
          ))}
        </group>
      )}
    </group>
  );
}
