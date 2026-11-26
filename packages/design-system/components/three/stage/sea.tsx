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

/** Minimum sea radius so open-ocean views never reveal a close horizon boundary. */
const MIN_SEA_RADIUS = 180;

/**
 * Open water at one level, as far as the eye reaches: it mirrors the sky and
 * whatever stands over it, its ripples drift, the setting's sun glints on it,
 * and it dissolves seamlessly into the sky horizon with a radial C2 falloff
 * and atmospheric haze so no hard edge is ever visible.
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
    const radius = Math.max(GROUND_REACHES * reach, MIN_SEA_RADIUS);
    ripples.wrapS = RepeatWrapping;
    ripples.wrapT = RepeatWrapping;
    const sea = new Water(new CircleGeometry(radius, 96), {
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
    sea.renderOrder = -10;
    sea.userData = { treatAsOpaque: true };
    // The ripples are sized for a sea a hundred units wide, so a wider sea draws them as often again.
    sea.material.uniforms.size.value = Math.max(1, radius / 60);
    sea.material.uniforms.uHorizonInner = { value: radius * 0.12 };
    sea.material.uniforms.uHorizonOuter = { value: radius * 0.68 };
    sea.material.transparent = true;
    sea.material.depthWrite = true;
    sea.material.fragmentShader = sea.material.fragmentShader
      .replace(
        "uniform vec3 waterColor;",
        "uniform vec3 waterColor;\nuniform float uHorizonInner;\nuniform float uHorizonOuter;"
      )
      .replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
float horizonT = clamp((length(worldPosition.xz) - uHorizonInner) / max(0.0001, uHorizonOuter - uHorizonInner), 0.0, 1.0);
float horizonSmooth = 1.0 - horizonT * horizonT * horizonT * (horizonT * (horizonT * 6.0 - 15.0) + 10.0);
gl_FragColor.a *= horizonSmooth * horizonSmooth;
if (gl_FragColor.a <= 0.002) discard;`
      );
    sea.material.needsUpdate = true;
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
