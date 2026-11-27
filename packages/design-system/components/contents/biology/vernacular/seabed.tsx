import { useFrame } from "@react-three/fiber";
import {
  bladeForms,
  meadow,
  motes,
  rockForms,
  rubble,
  seabedForms,
  shaftForms,
  shafts,
  surfaceForms,
  waterForms,
} from "@repo/design-system/components/contents/biology/vernacular/habitat";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { Body, Tuft } from "@repo/design-system/components/three/organism/body";
import type { Stroke } from "@repo/design-system/components/three/organism/life";
import { Skin } from "@repo/design-system/components/three/organism/skin";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";
import { useRef } from "react";
import type { Points } from "three";
import { AdditiveBlending, BackSide, BufferAttribute, DoubleSide } from "three";

/** Seagrass leans and recovers with the swell. */
const BLADE_STROKE: Stroke = {
  axis: 1,
  from: 0.1,
  reach: 0.22,
  to: 1,
  turns: 0.35,
};

const MEADOW = meadow(2600);
const RUBBLE = rubble(26);
const SHAFTS = shafts(9);
const MOTES = new BufferAttribute(motes(420), 3);

/** Marine snow drifting through the water column while the card plays. */
function Motes() {
  const ref = useRef<Points>(null);
  const playing = useVisualScene((card) => card.playing, false);

  useFrame((_, delta) => {
    const snow = ref.current;
    if (snow === null || !playing) {
      return;
    }
    snow.rotation.y += simulationStep(delta) * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <primitive attach="attributes-position" object={MOTES} />
      </bufferGeometry>
      <pointsMaterial
        color={CLASSIFICATION_COLORS.seaMote}
        depthWrite={false}
        opacity={0.55}
        size={0.006}
        transparent
      />
    </points>
  );
}

/**
 * The shallow seabed the five animals live over: banks of rippled sand, a
 * meadow of seagrass that sways, coral rubble, shafts of sunlight and
 * drifting marine snow.
 */
export function Seabed() {
  const dark =
    getThemeAppearance(useTheme((state) => state.resolvedTheme)) === "dark";

  return (
    <group>
      <group rotation={[0, 0, Math.PI / 2]}>
        <Body cast={false} shape={waterForms}>
          <meshBasicMaterial
            color={dark ? CLASSIFICATION_COLORS.seaNight : getColor("WHITE")}
            fog={false}
            side={BackSide}
            vertexColors
          />
        </Body>
      </group>
      <Body cast={false} shape={surfaceForms}>
        <meshBasicMaterial
          color={dark ? CLASSIFICATION_COLORS.seaNight : getColor("WHITE")}
          depthWrite={false}
          fog={false}
          opacity={0.6}
          side={DoubleSide}
          transparent
          vertexColors
        />
      </Body>
      <Body shape={seabedForms}>
        <Skin bump={0.22} repeat={[1.1, 1.1]} roughness={1} surface="sand" />
      </Body>
      <Tuft
        pace={1.3}
        placements={MEADOW}
        shape={bladeForms}
        stroke={BLADE_STROKE}
      >
        <Skin
          flesh={CLASSIFICATION_COLORS.seagrassTip}
          glow={0.5}
          repeat={[1, 1]}
          roughness={0.6}
          side={DoubleSide}
          surface="leaf"
          wet={0.5}
        />
      </Tuft>
      <Tuft placements={RUBBLE} shape={rockForms}>
        <Skin bump={1} repeat={[2, 2]} roughness={1} surface="stone" />
      </Tuft>
      <Tuft cast={false} placements={SHAFTS} shape={shaftForms}>
        <meshBasicMaterial
          blending={AdditiveBlending}
          depthWrite={false}
          opacity={0.07}
          side={DoubleSide}
          transparent
          vertexColors
        />
      </Tuft>
      <Motes />
    </group>
  );
}
