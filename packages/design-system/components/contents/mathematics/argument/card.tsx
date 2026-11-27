import { RoundedBox, useCursor } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import type { Shape } from "@repo/design-system/components/contents/mathematics/argument/layout";
import {
  CARD,
  printOf,
  TAB,
} from "@repo/design-system/components/contents/mathematics/argument/layout";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { ARGUMENT_COLORS } from "@repo/design-system/lib/material/argument";
import { Array as Arr, Option } from "effect";
import { useRef, useState } from "react";
import type { Group } from "three";
import { MathUtils } from "three";

/** How far a pointer may travel between press and release and still count as a click, in pixels. */
const CLICK_SLOP = 6;

/** How quickly a card glides to where it rests, as a damping rate a second. */
const GLIDE = 11;

/** How high a card rises at most while it travels, and while a pointer rests on it, in metres. */
const LIFT = { hover: 0.003, travel: 0.022 } as const;

/** The seal's radius: it sits on the card's corner, so half of it hangs off and none reaches the words. */
const SEAL = 0.0085;

/** Where a hand card's index tab sits along its right edge: near the top, as a filed card's would. */
const TAB_Z = -CARD.depth / 2 + TAB.depth / 2 + 0.008;

/**
 * One cream index card. It prints its words in ink, at the largest size at
 * which they fit, and glides to `rest` whenever that changes, rising a little
 * on the way, so a card dealt from the hand visibly travels into its slot. A
 * hand card carries a navy index tab with its punched shape, which the
 * toolbar's toggle for it shows too. A false card carries a red seal on its
 * corner. A card the learner can move answers a press.
 */
export function PaperCard({
  marked,
  onPress,
  rest,
  shape,
  text,
}: {
  readonly marked: boolean;
  readonly onPress: Option.Option<() => void>;
  readonly rest: { readonly x: number; readonly y: number; readonly z: number };
  readonly shape: Option.Option<Shape>;
  readonly text: string;
}) {
  const holder = useRef<Group>(null);
  const [hovering, setHovering] = useState(false);
  const pressable = Option.isSome(onPress);
  const print = printOf(text);
  useCursor(hovering && pressable);

  useFrame((state, delta) => {
    const card = holder.current;
    if (card === null) {
      return;
    }
    const step = Math.min(delta, 0.1);
    const away = Math.hypot(rest.x - card.position.x, rest.z - card.position.z);
    const height =
      rest.y + Math.min(LIFT.travel, away * 0.3) + (hovering ? LIFT.hover : 0);
    card.position.set(
      MathUtils.damp(card.position.x, rest.x, GLIDE, step),
      MathUtils.damp(card.position.y, height, GLIDE, step),
      MathUtils.damp(card.position.z, rest.z, GLIDE, step)
    );
    if (away + Math.abs(height - card.position.y) > 0.000_05) {
      state.invalidate();
    }
  });

  const press = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_SLOP) {
      return;
    }
    event.stopPropagation();
    Option.map(onPress, (run) => run());
  };

  return (
    <group position={[rest.x, rest.y, rest.z]} ref={holder}>
      <RoundedBox
        args={[CARD.width, CARD.thickness, CARD.depth]}
        castShadow
        position={[0, CARD.thickness / 2, 0]}
        radius={CARD.thickness / 2}
        receiveShadow
        smoothness={2}
      >
        <Matter color={ARGUMENT_COLORS.paper} of="paper" />
      </RoundedBox>
      <ThreeLabel
        color={ARGUMENT_COLORS.ink}
        fontSize={print.size}
        outlineColor={ARGUMENT_COLORS.paper}
        outlineWidth={print.size * 0.04}
        position={[0, CARD.thickness + 0.0004, 0]}
      >
        <span
          className="block text-center leading-tight font-medium text-balance whitespace-normal"
          style={{ width: print.width }}
        >
          {text}
        </span>
      </ThreeLabel>
      {Option.match(shape, {
        onNone: () => null,
        onSome: (each) => <IndexTab shape={each} />,
      })}
      {marked ? <Seal /> : null}
      {pressable ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: a three.js mesh takes pointer events, not focus; the toolbar's toggle is the keyboard and screen reader control for the same card.
        <mesh
          onClick={press}
          onPointerOut={() => setHovering(false)}
          onPointerOver={() => setHovering(true)}
          position={[TAB.reach / 2, CARD.thickness + 0.004, 0]}
          visible={false}
        >
          <boxGeometry
            args={[CARD.width + TAB.reach, 0.01, CARD.depth + 0.004]}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/** The navy index tab on a hand card's right edge, with its shape punched in cream. */
function IndexTab({ shape }: { readonly shape: Shape }) {
  const top = CARD.thickness + 0.0002;
  return (
    <group position={[CARD.width / 2 + TAB.reach / 2 - 0.002, 0, TAB_Z]}>
      <mesh castShadow position={[0, CARD.thickness / 2, 0]} receiveShadow>
        <boxGeometry args={[TAB.reach + 0.004, CARD.thickness, TAB.depth]} />
        <Matter color={ARGUMENT_COLORS.tab} of="paper" />
      </mesh>
      <mesh
        position={[0.001, top, 0]}
        rotation={[-Math.PI / 2, 0, shape === "triangle" ? Math.PI / 2 : 0]}
      >
        {shape === "square" ? (
          <planeGeometry args={[0.0068, 0.0068]} />
        ) : (
          <circleGeometry args={[0.0042, shape === "circle" ? 28 : 3]} />
        )}
        <Matter color={ARGUMENT_COLORS.tabShape} of="paper" />
      </mesh>
    </group>
  );
}

/** The red seal stamped on a false card's corner, with its cross. */
function Seal() {
  const top = CARD.thickness + 0.0011;
  return (
    <group position={[-CARD.width / 2 + 0.001, 0, -CARD.depth / 2 + 0.001]}>
      <mesh castShadow position={[0, CARD.thickness + 0.0005, 0]}>
        <cylinderGeometry args={[SEAL, SEAL, 0.001, 32]} />
        <Matter color={ARGUMENT_COLORS.seal} of="wax" />
      </mesh>
      {Arr.map([Math.PI / 4, -Math.PI / 4], (turn) => (
        <mesh key={turn} position={[0, top, 0]} rotation={[0, turn, 0]}>
          <boxGeometry args={[SEAL * 1.2, 0.0002, SEAL * 0.26]} />
          <Matter color={ARGUMENT_COLORS.sealCross} of="wax" />
        </mesh>
      ))}
    </group>
  );
}
