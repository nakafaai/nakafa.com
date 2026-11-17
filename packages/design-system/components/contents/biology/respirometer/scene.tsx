import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useRunClock } from "@repo/design-system/components/contents/biology/clock";
import {
  Bung,
  FlatRule,
  GlassTube,
  Trestle,
} from "@repo/design-system/components/contents/biology/glassware";
import {
  dropTravel,
  type Tube,
} from "@repo/design-system/components/contents/biology/respirometer/gas";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

/** The water bath: a glass tank on the bench, its middle and size in metres. */
const TANK = { depth: 0.17, height: 0.15, width: 0.17, x: -0.11 } as const;

/** How high the bath's water stands, in metres. */
const BATH_LEVEL = 0.115;

/** A boiling tube's outer radius and height, in metres. */
const TUBE = { height: 0.155, radius: 0.0125 } as const;

/** Where each respirometer stands across the bath, in metres: the potash one in front. */
const LANE = { potash: 0.045, water: -0.045 } as const;

/** How high the capillaries run over the rules, in metres. */
const CAPILLARY_HEIGHT = 0.205;

/** The coloured drop's length, in metres. */
const DROP = 0.012;

/** Where the coloured drop's middle starts, its leading edge on the rule's zero, in metres. */
const DROP_START = 0.21 + DROP / 2;

/** How many minutes pass in a second while the card plays. */
const MINUTES_PER_SECOND = 2;

/**
 * Both respirometers in their bath, their capillaries over two rules, and the
 * coloured drops, drawn from the run's clock every frame. The drops move at
 * real size: a millimetre of travel is a millimetre on the rule.
 */
export function RespirometerScene({
  carbonDioxide,
  elapsed,
  minutes,
  onElapsed,
  oxygen,
}: {
  readonly carbonDioxide: number;
  readonly elapsed: number;
  readonly minutes: number;
  readonly onElapsed: (minutes: number) => void;
  readonly oxygen: number;
}) {
  const clock = useRunClock({
    elapsed,
    onElapsed,
    perSecond: MINUTES_PER_SECOND,
    steps: 40,
    total: minutes,
  });
  const drops = { potash: useRef<Group>(null), water: useRef<Group>(null) };

  useFrame(() => {
    for (const tube of ["potash", "water"] as const) {
      const travel = dropTravel(
        tube,
        oxygen,
        carbonDioxide,
        clock.current,
        minutes
      );
      drops[tube].current?.position.set(
        DROP_START - travel / 1000,
        CAPILLARY_HEIGHT,
        LANE[tube]
      );
    }
  });

  return (
    <group>
      <RespirometerCamera />
      <LabBench />
      <group position={[0.12, 0, 0.1]}>
        <Bath />
        <Respirometer lane={LANE.potash} tube="potash" />
        <Respirometer lane={LANE.water} tube="water" />
        <Board />
        {Arr.map(["potash", "water"] as const, (tube) => (
          <group key={tube} ref={drops[tube]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.0024, 0.0024, DROP, 14]} />
              <LiquidMaterial color={MATERIAL.dye} opacity={0.92} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** The glass tank of the water bath, its water, and a thermometer in one corner. */
function Bath() {
  const walls = [
    {
      key: "front",
      position: [0, TANK.height / 2, TANK.depth / 2],
      size: [TANK.width, TANK.height, 0.003],
    },
    {
      key: "back",
      position: [0, TANK.height / 2, -TANK.depth / 2],
      size: [TANK.width, TANK.height, 0.003],
    },
    {
      key: "right",
      position: [TANK.width / 2, TANK.height / 2, 0],
      size: [0.003, TANK.height, TANK.depth],
    },
    {
      key: "left",
      position: [-TANK.width / 2, TANK.height / 2, 0],
      size: [0.003, TANK.height, TANK.depth],
    },
    {
      key: "floor",
      position: [0, 0.0015, 0],
      size: [TANK.width, 0.003, TANK.depth],
    },
  ] as const;
  return (
    <group position={[TANK.x, 0, 0]}>
      {Arr.map(walls, (wall) => (
        <mesh key={wall.key} position={wall.position}>
          <boxGeometry args={wall.size} />
          <GlassMaterial color={MATERIAL.glass} opacity={0.18} />
        </mesh>
      ))}
      <mesh position={[0, BATH_LEVEL / 2, 0]}>
        <boxGeometry
          args={[TANK.width - 0.006, BATH_LEVEL, TANK.depth - 0.006]}
        />
        <LiquidMaterial color={MATERIAL.pondWater} opacity={0.32} />
      </mesh>
      <group position={[TANK.width / 2 - 0.02, 0, -TANK.depth / 2 + 0.02]}>
        <GlassTube end={[0, 0.2, 0]} radius={0.003} start={[0, 0.03, 0]} />
        <mesh position={[0, 0.032, 0]}>
          <sphereGeometry args={[0.0035, 16, 12]} />
          <meshStandardMaterial color={MATERIAL.dye} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.0009, 0.0009, 0.1, 8]} />
          <meshStandardMaterial color={MATERIAL.dye} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * One respirometer: a boiling tube with potassium hydroxide solution or water
 * at its foot, germinating seeds on a wire gauze above it, a bung, and a
 * capillary that rises and turns along the board.
 */
function Respirometer({
  lane,
  tube,
}: {
  readonly lane: number;
  readonly tube: Tube;
}) {
  const ink = useLabelInk();
  const seeds = Arr.map(Arr.range(0, 9), (index) => {
    const angle = hashUnit(index, tube === "potash" ? 3 : 7) * Math.PI * 2;
    const reach = 0.0085 * Math.sqrt(hashUnit(index + 11, 5));
    return {
      key: index,
      position: [
        Math.cos(angle) * reach,
        0.058 + (index % 3) * 0.004,
        Math.sin(angle) * reach,
      ] as const,
      turn: angle,
    };
  });
  return (
    <group position={[TANK.x, 0, lane]}>
      <GlassTube
        end={[0, TUBE.height, 0]}
        radius={TUBE.radius}
        start={[0, 0.02, 0]}
      />
      <mesh position={[0, 0.02, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry
          args={[TUBE.radius, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]}
        />
        <GlassMaterial color={MATERIAL.glass} opacity={0.3} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry
          args={[TUBE.radius - 0.0015, TUBE.radius - 0.0015, 0.024, 28]}
        />
        <LiquidMaterial
          color={tube === "potash" ? MATERIAL.potash : MATERIAL.pondWater}
          opacity={0.7}
        />
      </mesh>
      <mesh position={[0, 0.054, 0]}>
        <cylinderGeometry
          args={[TUBE.radius - 0.0016, TUBE.radius - 0.0016, 0.0012, 28]}
        />
        <MetalMaterial color={MATERIAL.steelWool} roughness={0.55} />
      </mesh>
      {Arr.map(seeds, (seed) => (
        <mesh
          castShadow
          key={seed.key}
          position={seed.position}
          rotation={[0.4, seed.turn, 0.2]}
          scale={[1, 0.62, 0.72]}
        >
          <sphereGeometry args={[0.0034, 14, 10]} />
          <meshStandardMaterial color={MATERIAL.seed} roughness={0.55} />
        </mesh>
      ))}
      <group position={[0, TUBE.height + 0.008, 0]}>
        <Bung height={0.02} radius={TUBE.radius - 0.0012} />
      </group>
      <GlassTube
        end={[0, CAPILLARY_HEIGHT, 0]}
        radius={0.0034}
        start={[0, TUBE.height - 0.01, 0]}
      />
      <GlassTube
        end={[0.33, CAPILLARY_HEIGHT, 0]}
        opacity={0.14}
        radius={0.0034}
        start={[0, CAPILLARY_HEIGHT, 0]}
      />
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[-0.03, TUBE.height + 0.03, 0]}
      >
        <InlineMath
          math={tube === "potash" ? "\\mathrm{KOH}" : "\\mathrm{H_2O}"}
        />
      </ThreeLabel>
    </group>
  );
}

/** The stand the capillaries lie on, with a rule under each. */
function Board() {
  return (
    <group position={[0.11, 0, 0]}>
      <Trestle depth={0.16} height={CAPILLARY_HEIGHT - 0.0114} length={0.23} />
      {Arr.map([LANE.potash, LANE.water] as const, (lane) => (
        <group
          key={lane}
          position={[0, CAPILLARY_HEIGHT - 0.0094, lane + 0.012]}
        >
          <FlatRule length={0.2} step={5} zero="right" />
        </group>
      ))}
    </group>
  );
}

/** Looks across the bath and along the capillaries from the front, farther back on a narrow card. */
function RespirometerCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 0.9 : 0.66;
  return (
    <CameraControls
      cameraPosition={[0.16, 0.2 + distance * 0.55, 0.1 + distance * 0.85]}
      cameraTarget={[0.15, 0.13, 0.1]}
      fov={36}
      maxDistance={distance * 1.8}
      minDistance={0.16}
    />
  );
}
