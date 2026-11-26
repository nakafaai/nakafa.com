import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  AtomSphere,
  BondCylinder,
  CARBON_DX,
  CARBON_DY,
  CHAIN_Y,
  MONOMER_BASE_Y,
  PolymerDisplayBase,
  RIG_Z,
  SubstituentGroup,
} from "@repo/design-system/components/contents/chemistry/addition/apparatus";
import type { AdditionMonomer } from "@repo/design-system/components/contents/chemistry/addition/model";
import { evaluateAdditionChain } from "@repo/design-system/components/contents/chemistry/addition/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr, Match } from "effect";
import type { RefObject } from "react";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function AdditionCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 0.36, 1.2] : [0, 0.29, 0.9]}
      cameraTarget={[0, 0.185, 0.02]}
      fov={37}
      maxDistance={2.2}
      minDistance={0.38}
    />
  );
}

function topSubstituentFor(
  monomer: AdditionMonomer
): "chlorine" | "fluorine" | "hydrogen" | "methyl" {
  return Match.value(monomer).pipe(
    Match.when("ethene", () => "hydrogen" as const),
    Match.when("propene", () => "methyl" as const),
    Match.when("chloroethene", () => "chlorine" as const),
    Match.when("tetrafluoroethene", () => "fluorine" as const),
    Match.exhaustive
  );
}

function IncomingPlanarMonomer({
  monomer,
  ref,
}: {
  readonly monomer: AdditionMonomer;
  readonly ref: RefObject<Group | null>;
}) {
  const primary = topSubstituentFor(monomer);
  const other = monomer === "tetrafluoroethene" ? "fluorine" : "hydrogen";
  const leftC = [-0.024, 0, 0] as const;
  const rightC = [0.024, 0, 0] as const;

  return (
    <group position={[0, MONOMER_BASE_Y, RIG_Z]} ref={ref}>
      <AtomSphere
        color={ORGANIC_COLORS.carbonDark}
        position={leftC}
        radius={0.0125}
      />
      <AtomSphere
        color={ORGANIC_COLORS.carbonDark}
        position={rightC}
        radius={0.0125}
      />
      {/* Twin glowing golden C=C double-bond cylinders */}
      <BondCylinder
        color={ORGANIC_COLORS.doubleBondGold}
        emissive={ORGANIC_COLORS.doubleBondGold}
        emissiveIntensity={0.48}
        end={[0.024, 0.0052, 0]}
        radius={0.0034}
        start={[-0.024, 0.0052, 0]}
      />
      <BondCylinder
        color={ORGANIC_COLORS.doubleBondGold}
        emissive={ORGANIC_COLORS.doubleBondGold}
        emissiveIntensity={0.48}
        end={[0.024, -0.0052, 0]}
        radius={0.0034}
        start={[-0.024, -0.0052, 0]}
      />
      {/* Four 120-degree planar substituent bonds */}
      <SubstituentGroup
        anchor={leftC}
        direction={[-0.78, 0.62, 0.14]}
        kind={other}
      />
      <SubstituentGroup
        anchor={leftC}
        direction={[-0.78, -0.62, -0.14]}
        kind={other}
      />
      <SubstituentGroup
        anchor={rightC}
        direction={[0.78, 0.62, 0.14]}
        kind={primary}
      />
      <SubstituentGroup
        anchor={rightC}
        direction={[0.78, -0.62, -0.14]}
        kind={other}
      />
    </group>
  );
}

export function AdditionPolymerScene({
  chainLength,
  monomer,
  parts,
}: {
  readonly chainLength: number;
  readonly monomer: AdditionMonomer;
  readonly parts: Readonly<
    Record<
      "doubleBond" | "monomerUnit" | "sideGroup" | "singleBackbone",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const labelInk = useLabelInk();

  const chainRef = useRef<Group>(null);
  const monomerRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const units = evaluateAdditionChain(monomer, chainLength);
  const carbonCount = units.length * 2;
  const totalSpan = (carbonCount - 1) * CARBON_DX;
  const stanchionX = Math.min(0.268, totalSpan / 2 + 0.034);

  const carbons = useMemo(
    () =>
      Arr.makeBy(carbonCount, (idx) => {
        const unit = units[Math.floor(idx / 2)];
        const isPeak = idx % 2 === 1;
        const x = -totalSpan / 2 + idx * CARBON_DX;
        const y = isPeak ? CARBON_DY : -CARBON_DY;
        return {
          id: `c-${idx}`,
          isPeak,
          pos: [x, y, 0] as const,
          sideGroupKind: unit?.sideGroupKind ?? "hydrogen",
        };
      }),
    [carbonCount, totalSpan, units]
  );

  const bondPairs = useMemo(
    () =>
      Arr.makeBy(Math.max(0, carbonCount - 1), (idx) => ({
        end: carbons[idx + 1]?.pos ?? ([0, 0, 0] as const),
        id: `b-${idx}`,
        start: carbons[idx]?.pos ?? ([0, 0, 0] as const),
      })),
    [carbonCount, carbons]
  );

  useVisualStop(() => {
    phaseRef.current = 0;
    if (chainRef.current !== null) {
      chainRef.current.rotation.set(0, 0, 0);
    }
    if (monomerRef.current !== null) {
      monomerRef.current.position.set(0, MONOMER_BASE_Y, RIG_Z);
      monomerRef.current.rotation.set(0, 0, 0);
      monomerRef.current.scale.setScalar(1);
    }
    invalidate();
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.45;
    const p = phaseRef.current;
    if (chainRef.current !== null) {
      chainRef.current.rotation.y = Math.sin(p * 0.65) * 0.13;
    }
    if (monomerRef.current !== null) {
      const descent = (0.5 - 0.5 * Math.cos(p)) * 0.044;
      const pulse = 1 + Math.sin(p * 2) * 0.025;
      monomerRef.current.position.set(0, MONOMER_BASE_Y - descent, RIG_Z);
      monomerRef.current.rotation.z = Math.sin(p * 0.65) * 0.06;
      monomerRef.current.scale.setScalar(pulse);
    }
  });

  const firstPos = carbons[0]?.pos ?? ([-0.06, -CARBON_DY, 0] as const);
  const lastPos =
    carbons[carbonCount - 1]?.pos ?? ([0.06, CARBON_DY, 0] as const);
  const isPtfe = monomer === "tetrafluoroethene";

  return (
    <group>
      <SimulationTicker running={playing} />
      <AdditionCamera />
      <PolymerDisplayBase monomer={monomer} stanchionX={stanchionX} />

      {/* 3D tetrahedral zig-zag sp3 polymer chain suspended between stanchions */}
      <group position={[0, CHAIN_Y, RIG_Z]} ref={chainRef}>
        {/* Capped end continuations to stanchion clamps */}
        <BondCylinder
          color={BENCH_COLORS.panSteel}
          end={firstPos}
          radius={0.0036}
          start={[-stanchionX, 0, 0]}
        />
        <BondCylinder
          color={BENCH_COLORS.panSteel}
          end={[stanchionX, 0, 0]}
          radius={0.0036}
          start={lastPos}
        />

        {/* Machined metallic C-C single bonds along tetrahedral zig-zag */}
        {Arr.map(bondPairs, (bond) => (
          <BondCylinder
            end={bond.end}
            key={bond.id}
            radius={0.004}
            start={bond.start}
          />
        ))}

        {/* Carbon atoms + tetrahedral side groups */}
        {Arr.map(carbons, (carbon) => {
          const fallbackKind = isPtfe ? "fluorine" : "hydrogen";
          const frontKind = carbon.isPeak ? carbon.sideGroupKind : fallbackKind;
          const backKind = fallbackKind;
          const yDir = carbon.isPeak ? 0.84 : -0.84;

          return (
            <group key={carbon.id}>
              <AtomSphere
                color={ORGANIC_COLORS.carbonDark}
                position={carbon.pos}
                radius={0.0118}
              />
              <SubstituentGroup
                anchor={carbon.pos}
                direction={[0, yDir, 0.54]}
                kind={frontKind}
              />
              <SubstituentGroup
                anchor={carbon.pos}
                direction={[0, yDir, -0.54]}
                kind={backKind}
              />
            </group>
          );
        })}
      </group>

      {/* Incoming sp2 planar monomer hovering above chain */}
      <IncomingPlanarMonomer monomer={monomer} ref={monomerRef} />

      {/* Adaptive labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.175, 0.358, RIG_Z]}
      >
        <span>{parts.monomerUnit}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.175, 0.358, RIG_Z]}
      >
        <span>{parts.doubleBond}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.235, 0.252, RIG_Z + 0.03]}
      >
        <span>{parts.sideGroup}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0, 0.072, RIG_Z + 0.115]}
      >
        <span>{parts.singleBackbone}</span>
      </ThreeLabel>
    </group>
  );
}
