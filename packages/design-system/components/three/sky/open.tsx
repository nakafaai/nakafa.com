import { Environment } from "@react-three/drei";
import { Dome } from "@repo/design-system/components/three/sky/dome";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { Distance } from "@repo/design-system/components/three/stage/distance";
import { Haze, Sun } from "@repo/design-system/components/three/stage/settings";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { useMemo } from "react";
import { Color, LinearSRGBColorSpace } from "three";

/** How bright the ground's bounce is against the sky's own light, for a device that cannot hold the sky as a light. */
const BOUNCE = 0.35;

/** How many texels wide each face of the sky is drawn when it becomes the lab's light. */
const LIGHT_SIZE = 256;

/**
 * The sky's light as two flat tones, the haze from above and its bounce
 * off the ground from below, for a device that cannot draw the sky into a
 * light of its own.
 */
function FlatLight() {
  const { air, haze } = useStage();
  const bounce = useMemo(() => haze?.clone().multiplyScalar(BOUNCE), [haze]);

  if (air === undefined || haze === undefined) {
    return null;
  }

  return <hemisphereLight args={[haze, bounce, Math.PI * air.fill]} />;
}

/**
 * The open sky as a place: a field, or the air over the sea. The stage
 * draws the sky from the air of the place and takes all of the lab's light
 * from that same sky: the sun or the moon as the key light, in its colour
 * after its way through the air, and the sky itself, drawn once into the
 * light that fills shadows and shows in every reflection. The far distance
 * fades into the sky's own tone at the horizon, so ground, water and sky
 * meet without an edge.
 */
export function OpenSetting() {
  const { air, haze, profile, sun } = useStage();
  const color = useMemo(
    () =>
      air === undefined
        ? undefined
        : new Color().setRGB(...air.light, LinearSRGBColorSpace),
    [air]
  );

  if (air === undefined || haze === undefined) {
    return null;
  }

  return (
    <>
      <Dome air={air} />
      {profile.useExrEnvironment ? (
        <ErrorBoundary fallbackRender={() => <FlatLight />} report={false}>
          <Environment
            environmentIntensity={air.fill}
            frames={1}
            resolution={LIGHT_SIZE}
          >
            <Dome air={air} light />
          </Environment>
        </ErrorBoundary>
      ) : (
        <FlatLight />
      )}
      <Sun color={color} direction={sun} intensity={air.strength} />
      <Haze color={haze} />
      <Distance color={haze} />
    </>
  );
}
