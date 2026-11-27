import { useFrame } from "@react-three/fiber";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { bearForms } from "@repo/design-system/components/contents/biology/taxon/bear";
import { catForms } from "@repo/design-system/components/contents/biology/taxon/cat";
import { leopardForms } from "@repo/design-system/components/contents/biology/taxon/leopard";
import { tapirForms } from "@repo/design-system/components/contents/biology/taxon/tapir";
import { Body } from "@repo/design-system/components/three/organism/body";
import { Eye } from "@repo/design-system/components/three/organism/eye";
import type { Stroke } from "@repo/design-system/components/three/organism/life";
import { breathAt } from "@repo/design-system/components/three/organism/life";
import { Skin } from "@repo/design-system/components/three/organism/skin";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import type { ReactNode } from "react";
import { useRef } from "react";
import type { Group } from "three";

/** A leopard's long tail sways slowly from its root to its tip. */
const LEOPARD_TAIL: Stroke = {
  axis: 2,
  from: -0.3,
  reach: 0.05,
  to: -0.645,
  turns: 0.5,
};

/** A leopard cat's thick tail flicks from side to side. */
const CAT_TAIL: Stroke = {
  axis: 2,
  from: -0.29,
  reach: 0.04,
  to: -0.475,
  turns: 0.4,
};

/**
 * A standing animal that breathes while the card plays: its flanks fill and
 * empty, slowly, about the ground it stands on.
 */
function Breathing({
  children,
  scale,
  start,
}: {
  readonly children: ReactNode;
  readonly scale: number;
  readonly start: number;
}) {
  const ref = useRef<Group>(null);
  const phase = useRef(start);
  const playing = useVisualScene((card) => card.playing, false);

  useFrame((_, delta) => {
    const body = ref.current;
    if (body === null || !playing) {
      return;
    }
    phase.current += simulationStep(delta) * 1.7;
    const full = breathAt(phase.current, 0.012);
    body.scale.set(scale, scale * full, scale * full);
  });

  return (
    <group ref={ref} scale={scale}>
      {children}
    </group>
  );
}

/** A short, sleek coat of fur that lies from head to tail. */
function Coat({ gloss }: { readonly gloss: number }) {
  return (
    <Skin
      bump={0.7}
      repeat={[5, 3]}
      roughness={0.85}
      surface="fur"
      wet={gloss}
    />
  );
}

/** A leopard, Panthera pardus, standing on the ground with its head towards +x. */
export function LeopardSpecimen() {
  return (
    <Breathing scale={0.76} start={0}>
      <Body pace={1.3} shape={leopardForms} stroke={LEOPARD_TAIL}>
        <Coat gloss={0.06} />
      </Body>
      <Eye
        at={[0.366, 0.404, 0.047]}
        iris={CLASSIFICATION_COLORS.eyeAmber}
        look={[-0.75, 0]}
        pupil={CLASSIFICATION_COLORS.eyeDark}
        size={0.0095}
      />
      <Eye
        at={[0.366, 0.404, -0.047]}
        iris={CLASSIFICATION_COLORS.eyeAmber}
        look={[0.75, 0]}
        pupil={CLASSIFICATION_COLORS.eyeDark}
        size={0.0095}
      />
    </Breathing>
  );
}

/** A leopard cat, Prionailurus bengalensis, standing on the ground with its head towards +x. */
export function LeopardCatSpecimen() {
  return (
    <Breathing scale={0.56} start={1.4}>
      <Body pace={2.2} shape={catForms} stroke={CAT_TAIL}>
        <Coat gloss={0.06} />
      </Body>
      <Eye
        at={[0.336, 0.406, 0.037]}
        iris={CLASSIFICATION_COLORS.eyeAmber}
        look={[-0.7, 0]}
        pupil={CLASSIFICATION_COLORS.eyeDark}
        size={0.011}
      />
      <Eye
        at={[0.336, 0.406, -0.037]}
        iris={CLASSIFICATION_COLORS.eyeAmber}
        look={[0.7, 0]}
        pupil={CLASSIFICATION_COLORS.eyeDark}
        size={0.011}
      />
    </Breathing>
  );
}

/** A sun bear, Helarctos malayanus, standing on the ground with its head towards +x. */
export function SunBearSpecimen() {
  return (
    <Breathing scale={0.96} start={0.6}>
      <Body shape={bearForms}>
        <Coat gloss={0.06} />
      </Body>
      <Eye
        at={[0.328, 0.362, 0.052]}
        iris={CLASSIFICATION_COLORS.eyeBrown}
        look={[-0.7, 0]}
        pupil={CLASSIFICATION_COLORS.eyeDark}
        size={0.0075}
      />
      <Eye
        at={[0.328, 0.362, -0.052]}
        iris={CLASSIFICATION_COLORS.eyeBrown}
        look={[0.7, 0]}
        pupil={CLASSIFICATION_COLORS.eyeDark}
        size={0.0075}
      />
    </Breathing>
  );
}

/** A Malayan tapir, Tapirus indicus, standing on the ground with its head towards +x. */
export function TapirSpecimen() {
  return (
    <Breathing scale={0.85} start={2.1}>
      <Body shape={tapirForms}>
        <Coat gloss={0.06} />
      </Body>
      <Eye
        at={[0.325, 0.39, 0.058]}
        iris={CLASSIFICATION_COLORS.eyeBrown}
        look={[-1.1, 0]}
        pupil={CLASSIFICATION_COLORS.eyeDark}
        size={0.0075}
      />
      <Eye
        at={[0.325, 0.39, -0.058]}
        iris={CLASSIFICATION_COLORS.eyeBrown}
        look={[1.1, 0]}
        pupil={CLASSIFICATION_COLORS.eyeDark}
        size={0.0075}
      />
    </Breathing>
  );
}
