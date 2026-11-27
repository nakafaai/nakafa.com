import { useFrame } from "@react-three/fiber";
import { dugongForms } from "@repo/design-system/components/contents/biology/vernacular/dugong";
import {
  fringe,
  shoal,
} from "@repo/design-system/components/contents/biology/vernacular/habitat";
import {
  BELL_RADIUS,
  jellyfishForms,
  tentacleForms,
} from "@repo/design-system/components/contents/biology/vernacular/jellyfish";
import { mackerelForms } from "@repo/design-system/components/contents/biology/vernacular/mackerel";
import type { SeaAnimal } from "@repo/design-system/components/contents/biology/vernacular/model";
import { starForms } from "@repo/design-system/components/contents/biology/vernacular/star";
import { whaleForms } from "@repo/design-system/components/contents/biology/vernacular/whale";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { Body, Tuft } from "@repo/design-system/components/three/organism/body";
import { Eye } from "@repo/design-system/components/three/organism/eye";
import type { Stroke } from "@repo/design-system/components/three/organism/life";
import { breathAt } from "@repo/design-system/components/three/organism/life";
import { Skin } from "@repo/design-system/components/three/organism/skin";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Match } from "effect";
import { useRef } from "react";
import type { Group } from "three";
import { DoubleSide } from "three";

/** A sea cow sculls slowly: its fluke beats up and down from the middle of its back. */
const DUGONG_STROKE: Stroke = {
  axis: 1,
  from: 0.02,
  reach: 0.05,
  to: -0.46,
  turns: 0.4,
};

/** A rorqual's long tail stock carries a slow wave to its flukes. */
const WHALE_STROKE: Stroke = {
  axis: 1,
  from: 0.1,
  reach: 0.06,
  to: -0.7,
  turns: 0.45,
};

/** A mackerel swims with its tail: a quick side to side beat behind a stiff head. */
const MACKEREL_STROKE: Stroke = {
  axis: 2,
  from: 0.12,
  reach: 0.035,
  to: -0.3,
  turns: 0.7,
};

/** A tentacle trails and sways from the bell's margin. */
const TENTACLE_STROKE: Stroke = {
  axis: 2,
  from: 0,
  reach: 0.3,
  to: 1,
  turns: 0.8,
};

const TENTACLES = fringe(96, BELL_RADIUS * 0.97);
const SHOAL = shoal(5);

function Dugong() {
  return (
    <group>
      <Body pace={1.5} shape={dugongForms} stroke={DUGONG_STROKE}>
        <Skin
          bump={0.55}
          repeat={[16, 9]}
          roughness={0.95}
          surface="hide"
          wet={0.3}
        />
      </Body>
      <Eye
        at={[0.372, 0.018, 0.071]}
        iris={CLASSIFICATION_COLORS.eyeDark}
        look={[-1.25, 0.1]}
        pupil={CLASSIFICATION_COLORS.eyeDark}
        size={0.0075}
      />
      <Eye
        at={[0.372, 0.018, -0.071]}
        iris={CLASSIFICATION_COLORS.eyeDark}
        look={[1.25, 0.1]}
        pupil={CLASSIFICATION_COLORS.eyeDark}
        size={0.0075}
      />
    </group>
  );
}

function Whale() {
  return (
    <group>
      <Body pace={1.1} shape={whaleForms} start={1.4} stroke={WHALE_STROKE}>
        <Skin
          bump={0.35}
          repeat={[9, 4]}
          roughness={0.7}
          surface="mucosa"
          wet={0.75}
        />
      </Body>
      <Eye
        at={[0.47, -0.05, 0.097]}
        iris={CLASSIFICATION_COLORS.eyeDark}
        look={[-1.35, 0]}
        pupil={CLASSIFICATION_COLORS.eyeDark}
        size={0.007}
      />
      <Eye
        at={[0.47, -0.05, -0.097]}
        iris={CLASSIFICATION_COLORS.eyeDark}
        look={[1.35, 0]}
        pupil={CLASSIFICATION_COLORS.eyeDark}
        size={0.007}
      />
    </group>
  );
}

function MackerelSkin() {
  return (
    <Skin
      bump={0.5}
      metalness={0.45}
      repeat={[3, 3]}
      roughness={0.62}
      surface="scales"
      wet={0.8}
    />
  );
}

function Mackerel() {
  return (
    <group>
      <Body pace={7} shape={mackerelForms} stroke={MACKEREL_STROKE}>
        <MackerelSkin />
      </Body>
      <Eye
        at={[0.252, 0.012, 0.0265]}
        iris={CLASSIFICATION_COLORS.eyeSilver}
        look={[-1.45, 0]}
        pupil={CLASSIFICATION_COLORS.eyeDark}
        size={0.012}
      />
      <Eye
        at={[0.252, 0.012, -0.0265]}
        iris={CLASSIFICATION_COLORS.eyeSilver}
        look={[1.45, 0]}
        pupil={CLASSIFICATION_COLORS.eyeDark}
        size={0.012}
      />
      <Tuft
        pace={7}
        placements={SHOAL}
        shape={mackerelForms}
        stroke={MACKEREL_STROKE}
      >
        <MackerelSkin />
      </Tuft>
    </group>
  );
}

/** A moon jellyfish, whose bell tightens and opens as it swims while the card plays. */
function Jellyfish() {
  const ref = useRef<Group>(null);
  const phase = useRef(0);
  const playing = useVisualScene((card) => card.playing, false);

  useFrame((_, delta) => {
    const bell = ref.current;
    if (bell === null || !playing) {
      return;
    }
    phase.current += simulationStep(delta) * 2.4;
    const full = breathAt(phase.current, 0.16);
    bell.scale.set(1 / full, full * full, 1 / full);
  });

  return (
    <group ref={ref} rotation={[0, 0, 0.18]}>
      <Body cast={false} shape={jellyfishForms}>
        <Skin
          bump={0.25}
          clear={0.5}
          flesh={CLASSIFICATION_COLORS.jellyfish}
          glow={0.7}
          repeat={[5, 5]}
          roughness={0.35}
          side={DoubleSide}
          surface="mucosa"
          wet={1}
        />
      </Body>
      <Tuft
        cast={false}
        pace={2.4}
        placements={TENTACLES}
        shape={tentacleForms}
        stroke={TENTACLE_STROKE}
      >
        <Skin
          clear={0.45}
          flesh={CLASSIFICATION_COLORS.jellyfish}
          glow={0.7}
          repeat={[1, 1]}
          roughness={0.4}
          surface="mucosa"
          wet={1}
        />
      </Tuft>
    </group>
  );
}

function SeaStar() {
  return (
    <Body shape={starForms}>
      <Skin
        bump={1}
        repeat={[11, 11]}
        roughness={0.95}
        surface="tissue"
        wet={0.25}
      />
    </Body>
  );
}

/** One of the five sea animals, modelled from its own anatomy. */
export function AnimalModel({ animal }: { readonly animal: SeaAnimal }) {
  return Match.value(animal).pipe(
    Match.when("dugong", () => <Dugong />),
    Match.when("whale", () => <Whale />),
    Match.when("jellyfish", () => <Jellyfish />),
    Match.when("seaStar", () => <SeaStar />),
    Match.when("mackerel", () => <Mackerel />),
    Match.exhaustive
  );
}
