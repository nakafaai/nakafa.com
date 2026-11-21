import { Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useRunClock } from "@repo/design-system/components/contents/biology/clock";
import { SynapseProvider } from "@repo/design-system/components/contents/biology/synapse/context";
import { Dendrite } from "@repo/design-system/components/contents/biology/synapse/dendrite";
import { Drugs } from "@repo/design-system/components/contents/biology/synapse/drugs";
import {
  Calcium,
  Sodium,
} from "@repo/design-system/components/contents/biology/synapse/ions";
import {
  Acetylcholine,
  Ligands,
} from "@repo/design-system/components/contents/biology/synapse/molecules";
import { Terminal } from "@repo/design-system/components/contents/biology/synapse/terminal";
import type { Treatment } from "@repo/design-system/components/contents/biology/synapse/transmission";
import { RUN } from "@repo/design-system/components/contents/biology/synapse/transmission";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { SYNAPSE_COLORS } from "@repo/design-system/lib/material/synapse";
import { Schema } from "effect";
import type { ReactNode } from "react";
import { useEffect } from "react";

/** The parts and molecules the scene names. */
const PartSchema = Schema.Literals([
  "acetylcholine",
  "channel",
  "cleft",
  "enzyme",
  "mitochondrion",
  "receptor",
  "sodium",
  "transporter",
  "vesicle",
]);
type Part = typeof PartSchema.Type;

/**
 * One cholinergic synapse at the scale of an electron micrograph, cut open
 * through the middle of its active zone: the bouton above with its
 * mitochondrion and vesicles, the cleft, and the next neuron's dendrite
 * below with its receptor field. Each impulse plays in slow motion and the
 * rest of its interval quickly, so the run's clock is in seconds on the
 * screen, and every part reads the synapse's time from it.
 */
export function SynapseScene({
  elapsed,
  onElapsed,
  parts,
  rate,
  treatment,
}: {
  readonly elapsed: number;
  readonly onElapsed: (shown: number) => void;
  readonly parts: {
    readonly channel: ReactNode;
    readonly cleft: ReactNode;
    readonly enzyme: ReactNode;
    readonly mitochondrion: ReactNode;
    readonly receptor: ReactNode;
    readonly transporter: ReactNode;
    readonly vesicle: ReactNode;
  };
  readonly rate: number;
  readonly treatment: Treatment;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (playing) {
      invalidate();
    }
  }, [invalidate, playing]);
  const clock = useRunClock({
    elapsed,
    onElapsed,
    perSecond: 1,
    steps: Math.round(RUN * 10),
    total: RUN,
  });
  const ink = useLabelInk();
  const narrow = useThree(
    (state) => state.size.width < state.size.height * 1.2
  );
  const layout = narrow ? NARROW : WIDE;

  return (
    <SynapseProvider clock={clock} rate={rate} treatment={treatment}>
      <SynapseCamera />
      <directionalLight
        color={SYNAPSE_COLORS.rimLight}
        intensity={1.1}
        position={[-40, 30, -70]}
      />
      <directionalLight
        color={SYNAPSE_COLORS.fillLight}
        intensity={0.5}
        position={[60, -20, 40]}
      />
      <Terminal />
      <Dendrite />
      <Calcium />
      <Sodium />
      <Acetylcholine />
      <Ligands />
      <Drugs />
      <Callout ink={ink} place={layout.mitochondrion}>
        {parts.mitochondrion}
      </Callout>
      <Callout ink={ink} place={layout.vesicle}>
        {parts.vesicle}
      </Callout>
      <Callout ink={ink} place={layout.channel}>
        {parts.channel}
      </Callout>
      <Callout ink={ink} place={layout.transporter}>
        {parts.transporter}
      </Callout>
      <Callout ink={ink} place={layout.cleft}>
        {parts.cleft}
      </Callout>
      <Callout ink={ink} place={layout.receptor}>
        {parts.receptor}
      </Callout>
      <Callout ink={ink} place={layout.enzyme}>
        {parts.enzyme}
      </Callout>
      <Callout ink={ink} place={layout.acetylcholine}>
        <InlineMath math="\mathrm{ACh}" />
      </Callout>
      <Callout ink={ink} place={layout.sodium}>
        <InlineMath math="\mathrm{Na^{+}}" />
      </Callout>
    </SynapseProvider>
  );
}

/**
 * Where one label points and where it stands: the part it names, the end of
 * its leader line, and which side of that end its words lie on.
 */
const PlaceSchema = Schema.Struct({
  anchor: Schema.Literals(["center", "left", "right"]),
  label: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  part: Schema.NullOr(
    Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite])
  ),
});
type Place = typeof PlaceSchema.Type;

/** The labels of a wide card: in columns either side of the synapse, their lines reaching in. */
const WIDE: Readonly<Record<Part, Place>> = {
  acetylcholine: {
    anchor: "center",
    label: [3.5, -8.5, 0.6],
    part: [2.6, 1.7, -0.9],
  },
  channel: { anchor: "right", label: [-16, 7, 0.6], part: [-4.3, 2.6, -1] },
  cleft: { anchor: "left", label: [16, 2.6, 0.6], part: [11, 1.9, -1] },
  enzyme: { anchor: "right", label: [-16, -4.5, 0.6], part: [-8.6, 1.1, -1.2] },
  mitochondrion: {
    anchor: "left",
    label: [13.5, 26, 0.6],
    part: [7, 24.5, 0.2],
  },
  receptor: { anchor: "left", label: [16, -4, 0.6], part: [6.2, 0.3, -0.9] },
  sodium: {
    anchor: "center",
    label: [-3.5, -8.5, 0.6],
    part: [-1.6, -0.9, -0.9],
  },
  transporter: { anchor: "left", label: [16, 9, 0.6], part: [13.8, 3.9, -1.3] },
  vesicle: { anchor: "right", label: [-16, 15, 0.6], part: [-11.5, 11, -2] },
};

/**
 * The labels of a narrow card: on the organelles above, and in rows inside
 * the dendrite below, those on the left ending at their line and those on
 * the right starting at it. The outer parts take the upper rows, so every
 * line runs down beside the labels above it and none crosses another.
 */
const NARROW: Readonly<Record<Part, Place>> = {
  acetylcholine: {
    anchor: "left",
    label: [-0.5, -15.8, 0.6],
    part: [2.6, 1.7, -0.9],
  },
  channel: { anchor: "right", label: [-3, -8.6, 0.6], part: [-4.3, 2.6, -1] },
  cleft: { anchor: "left", label: [3, -8.6, 0.6], part: [11, 1.9, -1] },
  enzyme: { anchor: "right", label: [-4, -5, 0.6], part: [-8.6, 1.1, -1.2] },
  mitochondrion: { anchor: "center", label: [-4, 25, 0.6], part: null },
  receptor: {
    anchor: "left",
    label: [0.8, -12.2, 0.6],
    part: [6.2, 0.3, -0.9],
  },
  sodium: {
    anchor: "right",
    label: [-1.2, -12.2, 0.6],
    part: [-1.6, -0.9, -0.9],
  },
  transporter: {
    anchor: "left",
    label: [7, -5, 0.6],
    part: [13.8, 3.9, -1.3],
  },
  vesicle: { anchor: "center", label: [7, 13, 0.6], part: null },
};

/**
 * A label in the scene with a fine leader line from the part it names, and
 * a dot where it touches the part.
 */
function Callout({
  children,
  ink,
  place,
}: {
  readonly children: ReactNode;
  readonly ink: string;
  readonly place: Place;
}) {
  return (
    <group>
      {place.part === null ? null : (
        <group>
          <Line
            color={ink}
            depthWrite
            lineWidth={1}
            opacity={0.75}
            points={[place.part, place.label]}
            renderOrder={10}
            transparent
          />
          <mesh position={place.part} renderOrder={10}>
            <sphereGeometry args={[0.16, 12, 8]} />
            <meshBasicMaterial color={ink} />
          </mesh>
        </group>
      )}
      <ThreeLabel
        anchorX={place.anchor}
        color={ink}
        fontSize="compact"
        gap={place.anchor === "center" ? 0 : 0.5}
        position={place.label}
      >
        {children}
      </ThreeLabel>
    </group>
  );
}

/** Looks into the cut synapse from the front and a little above, farther back on a narrow card. */
function SynapseCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 94 : 70;
  return (
    <CameraControls
      cameraPosition={[7, narrow ? 9.5 : 15.5, distance]}
      cameraTarget={[0, narrow ? 5.5 : 11.3, -4]}
      fov={34}
      maxAzimuthAngle={1.1}
      maxDistance={distance * 1.8}
      maxPolarAngle={2}
      minAzimuthAngle={-1.1}
      minDistance={6}
      minPolarAngle={0.55}
    />
  );
}
