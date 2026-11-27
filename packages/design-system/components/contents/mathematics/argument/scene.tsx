import { useThree } from "@react-three/fiber";
import { PaperCard } from "@repo/design-system/components/contents/mathematics/argument/card";
import type { Seat } from "@repo/design-system/components/contents/mathematics/argument/chain";
import type {
  ArgumentCard,
  Joint,
} from "@repo/design-system/components/contents/mathematics/argument/form";
import {
  EXTENT,
  LINK_ROWS,
  RAIL,
  ShapeSchema,
  tableOf,
  viewDistance,
} from "@repo/design-system/components/contents/mathematics/argument/layout";
import { ChainLink } from "@repo/design-system/components/contents/mathematics/argument/link";
import {
  Lamp,
  Rail,
  Tray,
} from "@repo/design-system/components/contents/mathematics/argument/rail";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { Array as Arr, Option } from "effect";

/** The camera's vertical field of view, in degrees: narrow, so the cards stay square on. */
const FOV = 30;

/** How high the camera looks down on the table, in radians above it: nearly straight down, so every card reads flat. */
const ELEVATION = 1.3;

/**
 * The argument chain on a table: the oak rail with its three pockets and the
 * links between them down the left, the hand on its felt tray down the
 * right, and every card where it rests. Pressing a hand card moves it into
 * the chain or back to the tray. A false card in the chain carries a red seal
 * once the verdict shows.
 */
export function ArgumentScene({
  fixed,
  hand,
  joints,
  lit,
  names,
  onToggle,
  seats,
  showVerdict,
}: {
  readonly fixed: readonly Option.Option<ArgumentCard>[];
  readonly hand: readonly ArgumentCard[];
  readonly joints: readonly [Joint, Joint];
  readonly lit: boolean;
  readonly names: readonly [string, string, string];
  readonly onToggle: (card: number) => void;
  readonly seats: readonly Seat[];
  readonly showVerdict: boolean;
}) {
  const table = tableOf(fixed, hand, seats);
  return (
    <group>
      <ArgumentCamera />
      <Rail names={names}>
        <Lamp lit={lit} />
      </Rail>
      <Tray />
      {Arr.map(joints, (joint, index) => (
        <ChainLink
          joint={joint}
          key={LINK_ROWS[index]}
          z={Arr.getUnsafe(LINK_ROWS, index)}
        />
      ))}
      {Arr.map(table, (each) => (
        <PaperCard
          key={each.key}
          marked={showVerdict && each.slotted && !each.card.truth}
          onPress={Option.map(each.hand, (card) => () => onToggle(card))}
          rest={each.rest}
          shape={Option.flatMap(each.hand, (card) =>
            Arr.get(ShapeSchema.literals, card)
          )}
          text={each.card.text}
        />
      ))}
    </group>
  );
}

/**
 * Looks nearly straight down on the table from in front, standing back just
 * far enough that the rail and the tray fill the card at its shape.
 */
function ArgumentCamera() {
  const size = useThree((state) => state.size);
  const distance = viewDistance(size.width / size.height, ELEVATION, FOV);
  const target = [EXTENT.middle.x, RAIL.top, EXTENT.middle.z] as const;
  return (
    <CameraControls
      cameraPosition={[
        target[0],
        target[1] + distance * Math.sin(ELEVATION),
        target[2] + distance * Math.cos(ELEVATION),
      ]}
      cameraTarget={target}
      fov={FOV}
      maxAzimuthAngle={0.5}
      maxDistance={distance * 1.6}
      maxPolarAngle={0.6}
      minAzimuthAngle={-0.5}
      minDistance={distance * 0.4}
    />
  );
}
