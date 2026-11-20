import { useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  Desk,
  Pegboard,
} from "@repo/design-system/components/contents/mathematics/logic/board";
import { LampHolder } from "@repo/design-system/components/contents/mathematics/logic/bulb";
import type { Placement } from "@repo/design-system/components/contents/mathematics/logic/circuit";
import {
  BATTERY,
  carries,
  LAYOUTS,
  lampLit,
} from "@repo/design-system/components/contents/mathematics/logic/circuit";
import {
  CurrentMarks,
  Lead,
} from "@repo/design-system/components/contents/mathematics/logic/leads";
import {
  BASE_TOP,
  BatteryHolder,
  Resistor,
} from "@repo/design-system/components/contents/mathematics/logic/parts";
import { PARTS } from "@repo/design-system/components/contents/mathematics/logic/rig";
import { KnifeSwitch } from "@repo/design-system/components/contents/mathematics/logic/switch";
import type {
  Case,
  LogicMode,
} from "@repo/design-system/components/contents/mathematics/logic/truth";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";

/** The two switches the learner throws. */
export type SwitchName = "p" | "q";

/** Where the camera looks: the middle of the board, just above it. */
const TARGET = [0, 0.012, 0] as const;

/** How steeply the camera looks down on the board, in radians: more on a square narrow card, so the board fills it. */
const ELEVATION = { narrow: 1.12, wide: 0.92 } as const;

/**
 * The circuit kit on a desk, wired for one compound: the cells, the switches
 * P and Q, the lamp and, for not p, the resistor, joined by leads with
 * crocodile clips. Marks of current run along the live leads, and the lamp
 * lights when current runs through it. Pressing a switch throws it.
 */
export function LogicScene({
  mode,
  onToggle,
  state,
}: {
  readonly mode: LogicMode;
  readonly onToggle: (name: SwitchName) => void;
  readonly state: Case;
}) {
  const layout = LAYOUTS[mode];
  const live = useMemo(
    () =>
      Arr.flatMap(layout.leads, (lead, index) =>
        carries(lead.flow, state) ? [index] : []
      ),
    [layout, state]
  );
  const narrow = isNarrowThreeScene(
    useThree((three) => three.size),
    1.2
  );
  const ink = useLabelInk();

  return (
    <group>
      <LogicCamera narrow={narrow} />
      <Desk />
      <Pegboard />
      {Arr.map(layout.parts, ({ name, placement }) => (
        <PartAt key={name} placement={placement}>
          {name === "p" || name === "q" ? (
            <>
              <KnifeSwitch
                closed={state[name]}
                onToggle={() => onToggle(name)}
              />
              <ThreeLabel
                color={ink}
                fontSize="compact"
                position={[0, BASE_TOP + 0.002, PARTS.switch.depth / 2 + 0.011]}
              >
                {name.toUpperCase()}
              </ThreeLabel>
            </>
          ) : (
            <Fitting lit={lampLit(layout, state)} name={name} />
          )}
        </PartAt>
      ))}
      {narrow ? null : <CellSigns ink={ink} />}
      {Arr.map(layout.leads, (lead, index) => (
        <Lead
          color={lead.color}
          index={index}
          key={`${mode}-${lead.color}`}
          layout={layout}
        />
      ))}
      <CurrentMarks layout={layout} live={live} />
    </group>
  );
}

/** A part that only stands in the circuit: the cells, the lamp, lit or dark, or the resistor. */
function Fitting({
  lit,
  name,
}: {
  readonly lit: boolean;
  readonly name: "battery" | "lamp" | "resistor";
}) {
  if (name === "battery") {
    return <BatteryHolder />;
  }
  if (name === "lamp") {
    return <LampHolder lit={lit} />;
  }
  return <Resistor />;
}

/** Stands a part on the board where its layout places it. */
function PartAt({
  children,
  placement,
}: {
  readonly children: ReactNode;
  readonly placement: Placement;
}) {
  return (
    <group
      position={[placement.at[0], 0, placement.at[1]]}
      rotation={[0, placement.turn, 0]}
    >
      {children}
    </group>
  );
}

/** The + and - beside the cells' posts, which every layout puts in one place. */
function CellSigns({ ink }: { readonly ink: string }) {
  return (
    <PartAt placement={BATTERY}>
      {Arr.map(
        [
          { sign: "+", x: -PARTS.battery.reach },
          { sign: "−", x: PARTS.battery.reach },
        ],
        ({ sign, x }) => (
          <ThreeLabel
            color={ink}
            fontSize="compact"
            key={sign}
            position={[x, BASE_TOP, PARTS.battery.depth / 2 + 0.008]}
          >
            {sign}
          </ThreeLabel>
        )
      )}
    </PartAt>
  );
}

/** Looks down on the board from the front, farther back on a narrow card. */
function LogicCamera({ narrow }: { readonly narrow: boolean }) {
  const distance = narrow ? 0.6 : 0.46;
  const elevation = narrow ? ELEVATION.narrow : ELEVATION.wide;
  return (
    <CameraControls
      cameraPosition={[
        TARGET[0],
        TARGET[1] + distance * Math.sin(elevation),
        TARGET[2] + distance * Math.cos(elevation),
      ]}
      cameraTarget={TARGET}
      fov={36}
      maxAzimuthAngle={0.6}
      maxDistance={distance * 1.8}
      maxPolarAngle={Math.PI / 2 - 0.12}
      minAzimuthAngle={-0.6}
      minDistance={0.2}
    />
  );
}
