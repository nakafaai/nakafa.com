import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { GROUND_REACHES } from "@repo/design-system/components/three/stage/terrain";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { useEffect, useMemo } from "react";
import { CircleGeometry, RepeatWrapping, TextureLoader, Vector3 } from "three";
import { Water } from "three/examples/jsm/objects/Water.js";

/** The ripples every sea is drawn with: a normal map that tiles. */
const RIPPLES = "/models/physics/kinematics/water/waternormals.jpg";

/** How fast the ripples drift, in the water's own time per second. */
const DRIFT = 0.55;

/**
 * Open water at one level, as far as the eye reaches: it mirrors the sky and
 * whatever stands over it, its ripples drift, the setting's sun glints on it,
 * and it fades into the backdrop's horizon with the haze. It has no edge to
 * see, so no lab draws a sheet of water of its own. The camera leaves it out
 * when it frames the lab.
 *
 * @param level - The height of the water's surface
 * @param swell - How much the ripples bend what the water mirrors: calm water is near 1, open sea near 3
 */
export function Sea({
  level,
  swell = 2.4,
}: {
  readonly level: number;
  readonly swell?: number;
}) {
  const { reach, sun } = useStage();
  const fog = useThree((state) => state.scene.fog !== null);
  const ripples = useLoader(TextureLoader, RIPPLES);
  const water = useMemo(() => {
    ripples.wrapS = RepeatWrapping;
    ripples.wrapT = RepeatWrapping;
    const sea = new Water(new CircleGeometry(GROUND_REACHES * reach, 96), {
      alpha: 0.97,
      distortionScale: swell,
      fog,
      sunColor: getColor("WHITE"),
      sunDirection: new Vector3(...sun).normalize(),
      textureHeight: 512,
      textureWidth: 512,
      waterColor: PLOT_COLORS.teal,
      waterNormals: ripples,
    });
    sea.rotation.x = -Math.PI / 2;
    sea.userData = { treatAsOpaque: true };
    // The ripples are sized for a sea a hundred units wide, so a wider sea draws them as often again.
    sea.material.uniforms.size.value = Math.max(
      1,
      (reach * GROUND_REACHES) / 60
    );
    return sea;
  }, [fog, reach, ripples, sun, swell]);

  useEffect(
    () => () => {
      water.geometry.dispose();
      water.material.dispose();
    },
    [water]
  );

  useFrame((_, delta) => {
    water.material.uniforms.time.value += delta * DRIFT;
  });

  return (
    <CameraBounds exclude>
      <primitive object={water} position={[0, level, 0]} />
    </CameraBounds>
  );
}
