import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import type { Grouping } from "@repo/design-system/components/contents/mathematics/binary/bits";
import {
  groupsOf,
  lampCount,
  paddedSlots,
  placeValues,
  slotCount,
} from "@repo/design-system/components/contents/mathematics/binary/bits";
import {
  GlobeBulb,
  HOLDER,
  HOLDER_HEIGHT,
} from "@repo/design-system/components/contents/mathematics/binary/bulb";
import { advanceCounter } from "@repo/design-system/components/contents/mathematics/binary/counter";
import { GLOBE_HEIGHT } from "@repo/design-system/components/contents/mathematics/binary/globe";
import { ToggleSwitch } from "@repo/design-system/components/contents/mathematics/binary/lever";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { LAMP_COLORS } from "@repo/design-system/lib/material/lamp";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useRef } from "react";
import type { PointLight } from "three";

/** The distance between neighbouring lamps, in metres. */
const PITCH = 0.09;

/** The walnut case: its height and depth, and the margin beyond the end lamps, in metres. */
const CASE = { depth: 0.25, height: 0.05, margin: 0.05 } as const;

/** The brushed aluminium faceplate on top of the case, in metres. */
const FACE = { inset: 0.012, thickness: 0.0016 } as const;

/** The height the parts on the faceplate stand on. */
const TOP = CASE.height + FACE.thickness;

/** How far back each row of parts stands on the faceplate, in metres. */
const ROW = { bracket: 0.1, bulb: -0.07, plate: 0.05, toggle: -0.008 } as const;

/** Where each group's digit stands on the bench, just in front of the case. */
const DIGIT_ROW = CASE.depth / 2 + 0.02;

/** The engraved brass plate under each switch, in metres. */
const PLATE = { depth: 0.04, height: 0.0012, width: 0.062 } as const;

/** The two colours that tell neighbouring groups apart. */
const GROUP_COLORS = [PLOT_COLORS.teal, PLOT_COLORS.violet] as const;

/** How bright the panel's shared light is for each fully lit lamp. */
const LIGHT_PER_LAMP = 0.0015;

/** How high over the faceplate the shared light stands: the middle of a globe. */
const LIGHT_HEIGHT = 0.08;

/** The height of the top of a bulb above the faceplate, where its place value floats. */
const LAMP_TOP = HOLDER_HEIGHT + GLOBE_HEIGHT;

/**
 * How much higher every other lamp's value floats on a narrow card, so
 * neighbouring values such as 128 and 64 stand apart on a phone.
 */
const STAGGER = 0.06;

/** Whether the card is narrow, as on a phone, where the panel is framed from higher up. */
function isNarrow(size: { readonly height: number; readonly width: number }) {
  return size.width < size.height * 1.2;
}

/** The x position of a panel slot, the slots centred on the middle. */
function slotX(slot: number, slots: number) {
  return (slot - (slots - 1) / 2) * PITCH;
}

/** Reads the ink a label is written in, dark on a light page and light on a dark one. */
function useInk() {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  return getThemeAppearance(resolvedTheme) === "dark"
    ? ORIGIN_COLOR.LIGHT
    : ORIGIN_COLOR.DARK;
}

/**
 * A binary counting panel on a lab bench: a walnut case with a brushed
 * aluminium faceplate, a row of clear globe bulbs at the back, a toggle switch
 * in front of each bulb, and in front of each switch a brass plate with its
 * place value. The slots on the left that hold no lamp carry a blank cover;
 * when the row is read in pairs or threes, a painted bracket joins each group
 * and its digit in base four or eight stands in front of it, and a blank
 * slot inside a group reads 0. Without `showDigits`, the brackets stand
 * alone, so a question can ask for the other base's digits.
 * `PanelCounter` makes it count up.
 */
export function BinaryScene({
  bits,
  digits,
  grouping,
  showDigits,
  value,
}: {
  readonly bits: number;
  readonly digits: readonly number[];
  readonly grouping: Grouping;
  readonly showDigits: boolean;
  readonly value: number;
}) {
  const ink = useInk();
  const size = useThree((state) => state.size);
  const narrow = isNarrow(size);
  const slots = slotCount(bits);
  const lamps = lampCount(bits);
  const firstLamp = slots - lamps;
  const width = slots * PITCH + CASE.margin * 2;
  const glows = useRef(Arr.makeBy(lamps, () => 0));
  const padded = paddedSlots(bits, grouping);

  return (
    <group>
      <PanelCamera narrow={narrow} width={width} />
      <group position={[-1, 0, 0.12]}>
        <LabBench width={4} />
      </group>
      <PanelCase width={width} />
      <PanelLight glows={glows} lamps={lamps} slots={slots} />
      {Arr.map(Arr.range(0, slots - 1), (slot) =>
        slot < firstLamp ? (
          <BlankSlot
            ink={ink}
            key={slot}
            padded={Arr.contains(padded, slot)}
            x={slotX(slot, slots)}
          />
        ) : (
          <LampSlot
            glows={glows}
            index={slot - firstLamp}
            ink={ink}
            key={slot}
            lift={narrow && (slot - firstLamp) % 2 === 1 ? STAGGER : 0}
            on={digits[slot - firstLamp] === 1}
            place={placeValues(bits)[slot - firstLamp] ?? 1}
            power={lamps - 1 - (slot - firstLamp)}
            showPower={!narrow}
            x={slotX(slot, slots)}
          />
        )
      )}
      {grouping === "none"
        ? null
        : Arr.map(groupsOf(value, bits, grouping), (group, index) => (
            <GroupBracket
              color={groupColor(index)}
              from={slotX(group.first, slots)}
              key={group.first}
              to={slotX(group.last, slots)}
            >
              {showDigits ? (
                <ThreeLabel
                  anchorY="top"
                  color={groupColor(index)}
                  fontSize="annotation"
                  position={[0, -TOP, DIGIT_ROW - ROW.bracket]}
                >
                  <InlineMath math={String(group.digit)} />
                </ThreeLabel>
              ) : null}
            </GroupBracket>
          ))}
    </group>
  );
}

/**
 * Counts up while the card plays, at the panel's steady pace, and reports
 * how many counts each frame made so the card can step its number. It runs
 * before the bulbs heat, so a lamp switched on this frame starts warming now.
 */
export function PanelCounter({
  onCount,
}: {
  readonly onCount: (counts: number) => void;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const clock = useRef(0);
  useFrame((_, delta) => {
    if (!playing) {
      clock.current = 0;
      return;
    }
    const step = advanceCounter(clock.current, Math.min(delta, 0.1));
    clock.current = step.clock;
    if (step.counts > 0) {
      onCount(step.counts);
    }
  }, -2);
  return <SimulationTicker running={playing} />;
}

/** The walnut case and its brushed aluminium faceplate, with a screw at each corner. */
function PanelCase({ width }: { readonly width: number }) {
  const plateWidth = width - FACE.inset * 2;
  const plateDepth = CASE.depth - FACE.inset * 2;
  return (
    <group>
      <RoundedBox
        args={[width, CASE.height, CASE.depth]}
        castShadow
        position={[0, CASE.height / 2, 0]}
        radius={0.006}
        receiveShadow
      >
        <meshPhysicalMaterial
          clearcoat={0.5}
          clearcoatRoughness={0.35}
          color={LAMP_COLORS.walnut}
          roughness={0.55}
        />
      </RoundedBox>
      <mesh position={[0, CASE.height * 0.12, 0]}>
        <boxGeometry args={[width + 0.002, 0.004, CASE.depth + 0.002]} />
        <meshStandardMaterial color={LAMP_COLORS.walnutEdge} roughness={0.8} />
      </mesh>
      <mesh position={[0, CASE.height + FACE.thickness / 2, 0]} receiveShadow>
        <boxGeometry args={[plateWidth, FACE.thickness, plateDepth]} />
        <MetalMaterial color={LAMP_COLORS.aluminium} roughness={0.55} />
      </mesh>
      {Arr.map([-1, 1] as const, (side) =>
        Arr.map([-1, 1] as const, (end) => (
          <mesh
            key={`${side}${end}`}
            position={[
              side * (plateWidth / 2 - 0.008),
              TOP,
              end * (plateDepth / 2 - 0.008),
            ]}
          >
            <cylinderGeometry args={[0.0028, 0.003, 0.0012, 16]} />
            <MetalMaterial color={LAMP_COLORS.screw} roughness={0.3} />
          </mesh>
        ))
      )}
    </group>
  );
}

/**
 * The one warm light the lit lamps throw on the panel, standing over the
 * glow-weighted middle of the lit lamps with the strength of their glow
 * together, so the panel brightens as more lamps come on.
 */
function PanelLight({
  glows,
  lamps,
  slots,
}: {
  readonly glows: { readonly current: number[] };
  readonly lamps: number;
  readonly slots: number;
}) {
  const light = useRef<PointLight>(null);
  useFrame(() => {
    const current = light.current;
    if (current === null) {
      return;
    }
    const levels = glows.current;
    const total = Arr.reduce(levels, 0, (sum, level) => sum + level);
    const middle = Arr.reduce(
      levels,
      0,
      (sum, level, index) => sum + level * slotX(slots - lamps + index, slots)
    );
    current.intensity = total * LIGHT_PER_LAMP;
    current.position.set(
      total > 0 ? middle / total : 0,
      TOP + LIGHT_HEIGHT,
      ROW.bulb
    );
  });
  return (
    <pointLight
      color={LAMP_COLORS.lightWarm}
      distance={0.9}
      intensity={0}
      ref={light}
    />
  );
}

/**
 * One lamp's column: its bulb at the back, its switch in front of it, and
 * its brass plate. The place value in base ten stands over the bulb; the
 * plate reads it as a power of two, except on a narrow card, where the
 * plates sit too close for a label each.
 */
function LampSlot({
  glows,
  index,
  ink,
  lift,
  on,
  place,
  power,
  showPower,
  x,
}: {
  readonly glows: { readonly current: number[] };
  readonly index: number;
  readonly ink: string;
  readonly lift: number;
  readonly on: boolean;
  readonly place: number;
  readonly power: number;
  readonly showPower: boolean;
  readonly x: number;
}) {
  return (
    <group position={[x, TOP, 0]}>
      <group position={[0, 0, ROW.bulb]}>
        <GlobeBulb glows={glows} index={index} on={on} />
      </group>
      <group position={[0, 0, ROW.toggle]}>
        <ToggleSwitch on={on} />
      </group>
      <PlacePlate />
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.006}
        position={[0, LAMP_TOP + lift, ROW.bulb]}
      >
        <InlineMath math={String(place)} />
      </ThreeLabel>
      {showPower ? (
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[0, 0.004, ROW.plate]}
        >
          <InlineMath math={`2^{${power}}`} />
        </ThreeLabel>
      ) : null}
    </group>
  );
}

/** The engraved brass plate of one column, held by two small screws. */
function PlacePlate() {
  return (
    <group position={[0, 0, ROW.plate]}>
      <RoundedBox
        args={[PLATE.width, PLATE.height, PLATE.depth]}
        castShadow
        position={[0, PLATE.height / 2, 0]}
        radius={0.0005}
        receiveShadow
      >
        <MetalMaterial color={LAMP_COLORS.brassPlate} roughness={0.34} />
      </RoundedBox>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          key={side}
          position={[side * (PLATE.width / 2 - 0.005), PLATE.height, 0]}
        >
          <cylinderGeometry args={[0.0018, 0.002, 0.001, 12]} />
          <MetalMaterial color={LAMP_COLORS.screw} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A slot that holds no lamp, closed by a blank cover where a holder would
 * stand. Inside a group it reads 0, the zero that pads the group.
 */
function BlankSlot({
  ink,
  padded,
  x,
}: {
  readonly ink: string;
  readonly padded: boolean;
  readonly x: number;
}) {
  return (
    <group position={[x, TOP, 0]}>
      <mesh castShadow position={[0, 0.0015, ROW.bulb]} receiveShadow>
        <cylinderGeometry
          args={[HOLDER.flange.radius * 0.96, HOLDER.flange.radius, 0.003, 40]}
        />
        <MetalMaterial color={LAMP_COLORS.blankCover} roughness={0.4} />
      </mesh>
      <PlacePlate />
      {padded ? (
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[0, 0.004, ROW.plate]}
        >
          <InlineMath math="0" />
        </ThreeLabel>
      ) : null}
    </group>
  );
}

/** The paint of one group's bracket and digit, the groups taking the palette in turn. */
function groupColor(index: number) {
  return GROUP_COLORS[index % GROUP_COLORS.length] ?? PLOT_COLORS.teal;
}

/**
 * A bracket painted on the faceplate under one group of slots; `children`
 * stand in the bracket's frame, as the group's digit in front of it does.
 */
function GroupBracket({
  children,
  color,
  from,
  to,
}: {
  readonly children: ReactNode;
  readonly color: string;
  readonly from: number;
  readonly to: number;
}) {
  const span = to - from + PITCH * 0.82;
  const middle = (from + to) / 2;
  return (
    <group position={[middle, TOP, ROW.bracket]}>
      <mesh position={[0, 0.0004, 0]}>
        <boxGeometry args={[span, 0.0008, 0.0034]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh key={side} position={[(side * span) / 2, 0.0004, -0.0045]}>
          <boxGeometry args={[0.0034, 0.0008, 0.012]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      ))}
      {children}
    </group>
  );
}

/**
 * Looks at the panel from the front and a little above, the whole row in
 * view; a narrow card stands farther back so the end lamps stay in frame.
 */
function PanelCamera({
  narrow,
  width,
}: {
  readonly narrow: boolean;
  readonly width: number;
}) {
  const distance =
    (width / 2 + 0.04) / Math.tan(((narrow ? 15.5 : 22) * Math.PI) / 180);
  const elevation = ((narrow ? 46 : 36) * Math.PI) / 180;
  return (
    <CameraControls
      cameraPosition={[
        0,
        0.06 + distance * Math.sin(elevation),
        -0.01 + distance * Math.cos(elevation),
      ]}
      cameraTarget={[0, 0.06, -0.01]}
      fov={32}
      maxDistance={distance * 1.8}
      maxPolarAngle={Math.PI / 2.1}
      minDistance={0.15}
    />
  );
}
