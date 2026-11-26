import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { ColumnTower } from "@repo/design-system/components/contents/chemistry/fraction/column";
import {
  benchTrayY,
  FurnaceUnit,
  fractionHex,
  RIG_Z,
} from "@repo/design-system/components/contents/chemistry/fraction/furnace";
import type { PetroleumFraction } from "@repo/design-system/components/contents/chemistry/fraction/model";
import { evaluatePetroleumFraction } from "@repo/design-system/components/contents/chemistry/fraction/model";
import { OutletRack } from "@repo/design-system/components/contents/chemistry/fraction/outlets";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const WISP_INDICES = Arr.range(0, 9);

/** Coordinates of one rising hydrocarbon vapour wisp along the active path at `u` in [0, 1]. */
function wispCoords(
  u: number,
  targetY: number,
  index: number
): readonly [number, number, number] {
  if (u < 0.22) {
    const s = u / 0.22;
    return [
      -0.17 + s * 0.17,
      0.125 - s * 0.01,
      RIG_Z + Math.sin(s * Math.PI) * 0.01,
    ];
  }
  if (u < 0.78) {
    const s = (u - 0.22) / 0.56;
    const angle = s * Math.PI * 3.5 + index * 0.7;
    const radius = 0.022 + 0.012 * Math.sin(s * Math.PI);
    return [
      Math.cos(angle) * radius,
      0.115 + s * (targetY - 0.115),
      RIG_Z + Math.sin(angle) * radius,
    ];
  }
  const s = (u - 0.78) / 0.22;
  return [0.04 + s * 0.175, targetY - s * 0.018, RIG_Z + 0.008 * (1 - s)];
}

function FractionCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.01, 0.36, 1.38] : [0.01, 0.32, 1.08]}
      cameraTarget={[0.01, 0.26, RIG_Z]}
      fov={38}
      maxDistance={2.4}
      minDistance={0.35}
    />
  );
}

function VaporStream({
  color,
  playing,
  targetY,
}: {
  readonly color: string;
  readonly playing: boolean;
  readonly targetY: number;
}) {
  const groupRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  useFrame((_, delta) => {
    const container = groupRef.current;
    if (container === null) {
      return;
    }
    if (playing) {
      phaseRef.current = (phaseRef.current + simulationStep(delta) * 0.42) % 1;
    }
    for (const index of WISP_INDICES) {
      const child = container.children[index];
      if (child !== undefined) {
        const u = (phaseRef.current + index / WISP_INDICES.length) % 1;
        const [x, y, z] = wispCoords(u, targetY, index);
        child.position.set(x, y, z);
      }
    }
  });

  return (
    <group ref={groupRef}>
      {Arr.map(WISP_INDICES, (index) => {
        const u = index / WISP_INDICES.length;
        const [x, y, z] = wispCoords(u, targetY, index);
        return (
          <group key={index} position={[x, y, z]}>
            <mesh>
              <sphereGeometry args={[0.007, 12, 10]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.85}
                roughness={0.2}
              />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.012, 12, 10]} />
              <meshStandardMaterial
                color={color}
                depthWrite={false}
                emissive={color}
                emissiveIntensity={0.35}
                opacity={0.32}
                roughness={0.3}
                transparent
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function FractionalDistillationScene({
  fraction,
  parts,
}: {
  readonly fraction: PetroleumFraction;
  readonly parts: Readonly<
    Record<
      "bubbleCap" | "column" | "furnace" | "outletPipe" | "vaporStream",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const labelInk = useLabelInk();
  const selected = evaluatePetroleumFraction(fraction);
  const activeTrayY = benchTrayY(selected.trayY);
  const activeColor = fractionHex(fraction);

  return (
    <group>
      <SimulationTicker running={playing} />
      <FractionCamera />
      <LabBench width={2.8} />
      <FurnaceUnit />
      <ColumnTower activeFraction={fraction} />
      <OutletRack activeFraction={fraction} />
      <VaporStream
        color={activeColor}
        playing={playing}
        targetY={activeTrayY}
      />
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.28, 0.305, RIG_Z]}
      >
        <span>{parts.furnace}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0, 0.585, RIG_Z]}
      >
        <span>{parts.column}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={labelInk}
        fontSize="compact"
        position={[-0.11, 0.445, RIG_Z + 0.04]}
      >
        <span>{parts.bubbleCap}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={labelInk}
        fontSize="compact"
        position={[0.255, Math.max(0.205, activeTrayY), RIG_Z + 0.02]}
      >
        <span>
          {parts.outletPipe} ({selected.chainLength})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0, 0.036, RIG_Z + 0.13]}
      >
        <span>{parts.vaporStream}</span>
      </ThreeLabel>
    </group>
  );
}
