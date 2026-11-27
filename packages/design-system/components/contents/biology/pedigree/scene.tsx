import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { KaryotypeDisplay } from "@repo/design-system/components/contents/biology/chromatin";
import type { HumanPattern } from "@repo/design-system/components/contents/biology/pedigree/model";
import { evaluatePedigreeTree } from "@repo/design-system/components/contents/biology/pedigree/model";
import {
  BiologyBenchSurface,
  MolecularStick,
} from "@repo/design-system/components/contents/biology/workbench";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { ExtrudeGeometry, Shape } from "three";

function PedigreeCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.48, 3.8] : [0, 1.24, 3.24]}
      cameraTarget={[0, 0.7, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.4}
    />
  );
}

function createBeveledSquareGeometry(size: number, depth: number) {
  const h = size / 2;
  const r = size * 0.14;
  const shape = new Shape();
  shape.moveTo(-h + r, -h);
  shape.lineTo(h - r, -h);
  shape.quadraticCurveTo(h, -h, h, -h + r);
  shape.lineTo(h, h - r);
  shape.quadraticCurveTo(h, h, h - r, h);
  shape.lineTo(-h + r, h);
  shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r);
  shape.quadraticCurveTo(-h, -h, -h + r, -h);
  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.01,
    bevelThickness: 0.01,
    depth,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function statusFill(status: "affected" | "carrier" | "normal"): string {
  return Match.value(status).pipe(
    Match.when("normal", () => GENETICS_COLORS.frostedGlass),
    Match.when("carrier", () => GENETICS_COLORS.carrierAmber),
    Match.when("affected", () => GENETICS_COLORS.affectedRed),
    Match.exhaustive
  );
}

/** Illuminated museum-grade pedigree symbol medallion (beveled square for male, disc for female, half-shaded for carrier). */
function PedigreeMedallion({
  ink,
  label,
  sex,
  status,
  x,
  y,
}: {
  readonly ink: string;
  readonly label: string;
  readonly sex: "male" | "female";
  readonly status: "affected" | "carrier" | "normal";
  readonly x: number;
  readonly y: number;
}) {
  const squareGeo = useMemo(() => createBeveledSquareGeometry(0.18, 0.065), []);
  useEffect(() => () => squareGeo.dispose(), [squareGeo]);

  const fill = statusFill(status);

  return (
    <group position={[x, y, 0.045]}>
      {sex === "male" ? (
        <group>
          {/* Brass perimeter bezel */}
          <mesh castShadow geometry={squareGeo} scale={[1.09, 1.09, 0.85]}>
            <MetalMaterial
              color={GENETICS_COLORS.brassPolished}
              roughness={0.28}
            />
          </mesh>
          {status === "carrier" ? (
            <group>
              <mesh castShadow position={[-0.045, 0, 0.008]}>
                <boxGeometry args={[0.09, 0.175, 0.062]} />
                <meshPhysicalMaterial
                  clearcoat={0.7}
                  color={GENETICS_COLORS.carrierAmber}
                  emissive={GENETICS_COLORS.carrierAmber}
                  emissiveIntensity={0.22}
                  roughness={0.24}
                />
              </mesh>
              <mesh castShadow position={[0.045, 0, 0.008]}>
                <boxGeometry args={[0.09, 0.175, 0.062]} />
                <meshPhysicalMaterial
                  clearcoat={0.78}
                  color={GENETICS_COLORS.frostedGlass}
                  roughness={0.22}
                />
              </mesh>
            </group>
          ) : (
            <mesh castShadow geometry={squareGeo} position={[0, 0, 0.008]}>
              <meshPhysicalMaterial
                clearcoat={0.74}
                color={fill}
                emissive={fill}
                emissiveIntensity={status === "affected" ? 0.25 : 0.04}
                roughness={0.24}
              />
            </mesh>
          )}
        </group>
      ) : (
        <group>
          <mesh castShadow>
            <torusGeometry args={[0.104, 0.012, 12, 36]} />
            <MetalMaterial
              color={GENETICS_COLORS.brassPolished}
              roughness={0.26}
            />
          </mesh>
          {status === "carrier" ? (
            <group rotation={[Math.PI / 2, 0, 0]}>
              <mesh castShadow>
                <cylinderGeometry
                  args={[0.098, 0.098, 0.064, 28, 1, false, 0, Math.PI]}
                />
                <meshPhysicalMaterial
                  clearcoat={0.72}
                  color={GENETICS_COLORS.carrierAmber}
                  emissive={GENETICS_COLORS.carrierAmber}
                  emissiveIntensity={0.24}
                  roughness={0.24}
                />
              </mesh>
              <mesh castShadow>
                <cylinderGeometry
                  args={[0.098, 0.098, 0.064, 28, 1, false, Math.PI, Math.PI]}
                />
                <meshPhysicalMaterial
                  clearcoat={0.76}
                  color={GENETICS_COLORS.frostedGlass}
                  roughness={0.22}
                />
              </mesh>
            </group>
          ) : (
            <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.098, 0.098, 0.064, 32]} />
              <meshPhysicalMaterial
                clearcoat={0.74}
                color={fill}
                emissive={fill}
                emissiveIntensity={status === "affected" ? 0.25 : 0.04}
                roughness={0.24}
              />
            </mesh>
          )}
        </group>
      )}
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        position={[0, -0.17, 0.04]}
      >
        <span>{label}</span>
      </ThreeLabel>
    </group>
  );
}

export function PedigreeSexLinkedScene({
  parts,
  pattern,
}: {
  readonly parts: Readonly<
    Record<
      | "affected"
      | "carrier"
      | "female"
      | "male"
      | "xChromosome"
      | "yChromosome",
      string
    >
  >;
  readonly pattern: HumanPattern;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const ink = useLabelInk();
  const tableRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const nodes = evaluatePedigreeTree(pattern);

  const rewind = () => {
    phaseRef.current = 0;
    if (tableRef.current !== null) {
      tableRef.current.rotation.set(0, 0, 0);
    }
    invalidate();
  };

  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing || tableRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.65;
    tableRef.current.rotation.y = Math.sin(phaseRef.current) * 0.16;
  });

  const children = Arr.filter(nodes, (n) => n.y < 0.8);
  const minChildX = Arr.reduce(children, 0, (acc, n) => Math.min(acc, n.x));
  const maxChildX = Arr.reduce(children, 0, (acc, n) => Math.max(acc, n.x));

  return (
    <group>
      <SimulationTicker running={playing} />
      <PedigreeCamera />
      <BiologyBenchSurface radius={14} y={0} />

      <group ref={tableRef}>
        {/* Illuminated glass-and-brass genetics light-table stand */}
        <mesh castShadow position={[0, 0.032, 0]} receiveShadow>
          <boxGeometry args={[2.16, 0.064, 0.72]} />
          <meshPhysicalMaterial
            clearcoat={0.38}
            color={GENETICS_COLORS.slatePlinth}
            metalness={0.5}
            roughness={0.36}
          />
        </mesh>
        <mesh position={[0, 0.068, 0.34]}>
          <boxGeometry args={[2.04, 0.01, 0.014]} />
          <MetalMaterial
            color={GENETICS_COLORS.brassPolished}
            roughness={0.26}
          />
        </mesh>

        {/* Vertical brass easel posts supporting the frosted glass light-panel */}
        {Arr.map([-0.92, 0.92] as const, (px) => (
          <mesh castShadow key={px} position={[px, 0.66, -0.02]}>
            <cylinderGeometry args={[0.022, 0.026, 1.24, 20]} />
            <MetalMaterial
              color={GENETICS_COLORS.brassPolished}
              roughness={0.28}
            />
          </mesh>
        ))}

        {/* Illuminated frosted acrylic display pane */}
        <mesh position={[0, 0.76, -0.02]}>
          <boxGeometry args={[1.82, 0.98, 0.024]} />
          <GlassMaterial color={GENETICS_COLORS.frostedGlass} opacity={0.24} />
        </mesh>
        {/* Top and bottom brass light rails */}
        <mesh castShadow position={[0, 1.255, -0.02]}>
          <boxGeometry args={[1.88, 0.024, 0.04]} />
          <MetalMaterial
            color={GENETICS_COLORS.brassPolished}
            roughness={0.26}
          />
        </mesh>
        <mesh castShadow position={[0, 0.275, -0.02]}>
          <boxGeometry args={[1.88, 0.024, 0.04]} />
          <MetalMaterial
            color={GENETICS_COLORS.brassPolished}
            roughness={0.26}
          />
        </mesh>

        {/* Glowing fiber-optic lineage connectors */}
        <MolecularStick
          color={GENETICS_COLORS.fiberGlow}
          emissive={GENETICS_COLORS.fiberGlow}
          emissiveIntensity={0.45}
          end={[0.42, 1.04, 0.01]}
          radius={0.012}
          start={[-0.42, 1.04, 0.01]}
        />
        <MolecularStick
          color={GENETICS_COLORS.fiberGlow}
          emissive={GENETICS_COLORS.fiberGlow}
          emissiveIntensity={0.45}
          end={[0, 0.76, 0.01]}
          radius={0.012}
          start={[0, 1.04, 0.01]}
        />
        <MolecularStick
          color={GENETICS_COLORS.fiberGlow}
          emissive={GENETICS_COLORS.fiberGlow}
          emissiveIntensity={0.45}
          end={[maxChildX, 0.76, 0.01]}
          radius={0.012}
          start={[minChildX, 0.76, 0.01]}
        />
        {Arr.map(children, (child) => (
          <MolecularStick
            color={GENETICS_COLORS.fiberGlow}
            emissive={GENETICS_COLORS.fiberGlow}
            emissiveIntensity={0.45}
            end={[child.x, child.y + 0.08, 0.01]}
            key={`drop-${child.id}`}
            radius={0.01}
            start={[child.x, 0.76, 0.01]}
          />
        ))}

        {/* Pedigree medallions */}
        {Arr.map(nodes, (node) => (
          <PedigreeMedallion
            ink={ink}
            key={node.id}
            label={node.label}
            sex={node.sex}
            status={node.status}
            x={node.x}
            y={node.y}
          />
        ))}

        {/* Sculpted X and Y karyotype chromosomes displayed on the plinth base */}
        <group position={[0, 0.1, 0.18]} scale={0.82}>
          <KaryotypeDisplay position={[0, 0.06, 0]} />
        </group>
      </group>

      {/* Non-overlapping adaptive-ink labels */}
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-1.0, 1.06, 0]}
      >
        <span>{parts.male}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[0.76, 1.3, 0]}
      >
        <span>
          {parts.female} / {parts.carrier}
        </span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[0.98, 0.58, 0]}
      >
        <span>{parts.affected}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.5, 0.18, 0.18]}
      >
        <span>{parts.xChromosome}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[0.5, 0.18, 0.18]}
      >
        <span>{parts.yChromosome}</span>
      </ThreeLabel>
    </group>
  );
}
