import { useFrame, useThree } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  DepthOfField,
  EffectComposer,
  HueSaturation,
  N8AO,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import type { DepthOfFieldEffect } from "postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useRef } from "react";
import { Vector3 } from "three";

/** Where the camera looks when no controls name a target, the lab's middle. */
const ORIGIN = new Vector3();

/**
 * Keeps the lens focused on what the reader orbits: the target of the
 * scene's default controls, read every frame so a pan or a zoom refocuses.
 */
function Lens() {
  const { reach } = useStage();
  const lens = useRef<DepthOfFieldEffect>(null);
  const controls = useThree((state) => state.controls);

  useFrame(() => {
    if (lens.current === null) {
      return;
    }
    lens.current.target =
      controls !== null &&
      "target" in controls &&
      controls.target instanceof Vector3
        ? controls.target
        : ORIGIN;
  });

  return (
    <DepthOfField bokehScale={2.5} ref={lens} worldFocusRange={2.4 * reach} />
  );
}

/**
 * The photographic finish every lab is drawn through. Ambient occlusion
 * darkens the creases and contacts the key light cannot reach; on a desktop a
 * shallow depth of field softens what lies beyond the lab and bloom lets
 * glowing parts glow, above twice the brightness of a lit white surface so a
 * white ball in sunlight stays a ball. Khronos PBR Neutral tone mapping keeps every authored
 * color true below its highlights and rolls the highlights off softly, a
 * light grade adds contrast and color, and a vignette draws the eye in.
 *
 * A phone skips the depth of field and the bloom and computes the occlusion
 * at half resolution, and its high pixel density stands in for multisampling.
 */
export function Finish() {
  const { phone, reach } = useStage();

  return (
    <EffectComposer multisampling={phone ? 0 : 4}>
      <N8AO
        aoRadius={0.2 * reach}
        distanceFalloff={1}
        halfRes={phone}
        intensity={2.5}
        quality={phone ? "performance" : "medium"}
      />
      {phone ? null : <Lens />}
      {phone ? null : (
        <Bloom
          intensity={0.5}
          luminanceSmoothing={0.2}
          luminanceThreshold={2}
          mipmapBlur
        />
      )}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <HueSaturation saturation={0.08} />
      <BrightnessContrast contrast={0.06} />
      <Vignette darkness={0.42} offset={0.32} />
    </EffectComposer>
  );
}
