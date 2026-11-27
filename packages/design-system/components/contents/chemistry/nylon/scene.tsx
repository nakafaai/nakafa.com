import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  BenzeneBlock,
  CHAIN_Y,
  CondensationBenchBase,
  CondensationLinkage,
  HydrocarbonBlock,
  RIG_Z,
  STANCHION_X,
  WaterMolecule3D,
} from "@repo/design-system/components/contents/chemistry/nylon/apparatus";
import type { CondensationPolymer } from "@repo/design-system/components/contents/chemistry/nylon/model";
import { evaluateCondensationPolymer } from "@repo/design-system/components/contents/chemistry/nylon/model";
import { BondCylinder } from "@repo/design-system/components/contents/chemistry/specimen";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const BLOCKS = [
  { id: "blk-0", isA: true, x: -0.186 },
  { id: "blk-1", isA: false, x: -0.062 },
  { id: "blk-2", isA: true, x: 0.062 },
  { id: "blk-3", isA: false, x: 0.186 },
] as const;

const LINKS = [
  { id: "lnk-0", offset: 0, x: -0.124 },
  { id: "lnk-1", offset: 0.33, x: 0 },
  { id: "lnk-2", offset: 0.66, x: 0.124 },
] as const;

function NylonCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 0.36, 1.22] : [0, 0.29, 0.94]}
      cameraTarget={[0, 0.145, 0.03]}
      fov={37}
      maxDistance={2.2}
      minDistance={0.38}
    />
  );
}

export function CondensationNylonScene({
  parts,
  polymer,
}: {
  readonly parts: Readonly<
    Record<
      | "esterOrAmideLink"
      | "monomerA"
      | "monomerB"
      | "polymerChain"
      | "waterByproduct",
      string
    >
  >;
  readonly polymer: CondensationPolymer;
}) {
  const labelInk = useLabelInk();
  const chainRef = useRef<Group>(null);
  const waterRefs = useRef<(Group | null)[]>([]);
  const { advance, playing } = useSimulationClock(0);
  const profile = evaluateCondensationPolymer(polymer);

  useFrame((_, delta) => {
    const t = advance(delta);
    if (chainRef.current !== null) {
      chainRef.current.rotation.x = Math.sin(t * 0.9) * 0.12;
    }
    for (let i = 0; i < LINKS.length; i += 1) {
      const drop = waterRefs.current[i];
      const spec = LINKS[i];
      if (drop !== null && drop !== undefined && spec !== undefined) {
        const cycle = (t * 0.45 + spec.offset) % 1;
        const y = CHAIN_Y - 0.042 - cycle * 0.092;
        const z = RIG_Z + 0.016 + cycle * 0.014;
        drop.position.set(spec.x * (1 - cycle * 0.55), y, z);
        drop.rotation.set(cycle * 1.4, cycle * 2.2, 0);
      }
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <NylonCamera />
      <CondensationBenchBase polymer={polymer} />

      {/* Suspended 3D condensation polymer chain */}
      <group position={[0, CHAIN_Y, RIG_Z]} ref={chainRef}>
        <BondCylinder
          color={BENCH_COLORS.panSteel}
          end={[-0.228, 0, 0]}
          radius={0.0036}
          start={[-STANCHION_X, 0, 0]}
        />
        <BondCylinder
          color={BENCH_COLORS.panSteel}
          end={[STANCHION_X, 0, 0]}
          radius={0.0036}
          start={[0.228, 0, 0]}
        />

        {Arr.map(BLOCKS, (blk) =>
          blk.isA || profile.isAmide ? (
            <HydrocarbonBlock
              accentColor={
                blk.isA ? ORGANIC_COLORS.monomerA : ORGANIC_COLORS.monomerB
              }
              key={blk.id}
              x={blk.x}
            />
          ) : (
            <BenzeneBlock
              accentColor={ORGANIC_COLORS.monomerB}
              key={blk.id}
              x={blk.x}
            />
          )
        )}

        {Arr.map(LINKS, (lnk) => (
          <CondensationLinkage
            isAmide={profile.isAmide}
            key={lnk.id}
            x={lnk.x}
          />
        ))}
      </group>

      {/* Eliminated 3D H₂O condensation byproduct molecules descending into watch glass */}
      {Arr.map(LINKS, (lnk, index) => (
        <group
          key={`h2o-${lnk.id}`}
          position={[
            lnk.x * (1 - lnk.offset * 0.55),
            CHAIN_Y - 0.042 - lnk.offset * 0.092,
            RIG_Z + 0.016 + lnk.offset * 0.014,
          ]}
          ref={(el) => {
            waterRefs.current[index] = el;
          }}
        >
          <WaterMolecule3D />
        </group>
      ))}

      {/* Non-overlapping adaptive labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[-0.21, 0.278, RIG_Z]}
      >
        <span>{parts.monomerA}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[0.21, 0.278, RIG_Z]}
      >
        <span>{parts.monomerB}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[0, 0.335, RIG_Z]}
      >
        <span>
          {parts.esterOrAmideLink} ({profile.linkLabel})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[-0.195, 0.096, RIG_Z + 0.06]}
      >
        <span>{parts.polymerChain}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[0.165, 0.088, RIG_Z + 0.068]}
      >
        <span>{parts.waterByproduct}</span>
      </ThreeLabel>
    </group>
  );
}
