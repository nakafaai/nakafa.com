import { Line } from "@react-three/drei";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  FIBRE,
  stationOf,
} from "@repo/design-system/components/contents/biology/neuron/course";
import { plateOf } from "@repo/design-system/components/contents/biology/neuron/muscle";
import {
  CUT,
  ELECTRODE,
} from "@repo/design-system/components/contents/biology/neuron/playback";
import { SOMA } from "@repo/design-system/components/contents/biology/neuron/soma";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Array as Arr } from "effect";
import { Vector3 } from "three";

/** A point `offset` from `from`. */
function beside(from: Vector3, offset: readonly [number, number, number]) {
  return from.clone().add(new Vector3(...offset));
}

/**
 * Where each label stands and the point of the part it names, each label
 * placed in open space beside its part so no two labels meet, none lies over
 * the neuron and all stay inside a narrow card: the cell body's name in the
 * gap its dendrites leave above it, the myelin's above the first internode,
 * the node's below the node the electrode records from, the axon's beside
 * the cut face that shows it inside its sheath, and the terminal's above the
 * muscle. The myelin and the node are named only on a myelinated fibre.
 */
function placements(myelinated: boolean) {
  const sheath = stationOf(0.5).point;
  const node = stationOf(ELECTRODE).point;
  const cut = stationOf(CUT + 0.02).point;
  const plate = plateOf(1).point;
  const dendrite = beside(SOMA.centre, [-3.3, -3.6, 0.3]);
  const all = [
    {
      anchor: "bottom" as const,
      at: beside(SOMA.centre, [3, 6, 0.5]),
      key: "soma" as const,
      target: beside(SOMA.centre, [1.2, 2.6, 0.6]),
    },
    {
      anchor: "top" as const,
      at: beside(dendrite, [-1, -3.8, 0.2]),
      key: "dendrite" as const,
      target: dendrite,
    },
    {
      anchor: "bottom" as const,
      at: beside(sheath, [1.4, 3.7, 0]),
      key: "myelin" as const,
      target: beside(sheath, [0, FIBRE.outer - 0.05, 0]),
    },
    {
      anchor: "top" as const,
      at: beside(node, [-0.3, -2.6, 0.1]),
      key: "node" as const,
      target: beside(node, [0, -FIBRE.node - 0.1, 0]),
    },
    {
      anchor: "middle" as const,
      at: beside(cut, [2.6, 0, 0.2]),
      key: "axon" as const,
      target: cut,
    },
    {
      anchor: "bottom" as const,
      at: beside(plate, [-4.5, 4.5, 2.8]),
      key: "terminal" as const,
      target: beside(plate, [0, 0.2, 0]),
    },
  ];
  return myelinated
    ? all
    : Arr.filter(all, (part) => part.key !== "myelin" && part.key !== "node");
}

/**
 * The names of the neuron's parts, each joined by a thin leader to the part
 * it names, in the ink of the card's theme so they read on light and dark.
 */
export function PartLabels({
  myelinated,
  parts,
}: {
  readonly myelinated: boolean;
  readonly parts: Readonly<{
    axon: string;
    dendrite: string;
    myelin: string;
    node: string;
    soma: string;
    terminal: string;
  }>;
}) {
  const ink = useLabelInk();
  return (
    <group>
      {Arr.map(placements(myelinated), (part) => (
        <group key={part.key}>
          <Line
            color={ink}
            lineWidth={1}
            opacity={0.55}
            points={[part.at, part.target]}
            transparent
          />
          <ThreeLabel
            anchorY={part.anchor}
            color={ink}
            fontSize="compact"
            gap={0.12}
            position={part.at}
          >
            {parts[part.key]}
          </ThreeLabel>
        </group>
      ))}
    </group>
  );
}
