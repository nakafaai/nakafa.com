import type { Blade } from "@repo/design-system/components/three/flora/blade";
import { Foliage } from "@repo/design-system/components/three/flora/foliage";
import { growHead } from "@repo/design-system/components/three/flora/head";
import { leavesOf } from "@repo/design-system/components/three/flora/solid";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
import { useEffect, useMemo } from "react";
import { ConeGeometry, MeshPhysicalMaterial } from "three";

/** One ray floret: a long strap, keeled, with a few veins and a notched tip. */
const RAY: Blade = {
  arch: 0.16,
  columns: 6,
  fold: 0.22,
  length: 1,
  outline: "obovate",
  relief: 0.01,
  rows: 12,
  teeth: 0,
  veins: 3,
  wave: 0.08,
  width: 0.3,
};

/** One bract of the cup under the head: short, pointed and stiff. */
const BRACT: Blade = {
  arch: 0.1,
  columns: 4,
  fold: 0.3,
  length: 1,
  outline: "ovate",
  relief: 0.008,
  rows: 8,
  teeth: 0,
  veins: 3,
  wave: 0,
  width: 0.5,
};

/**
 * A flower head of the daisy family at the tip of a stem: a ring of ray
 * florets that fold back as it opens, a cup of green bracts under it and a
 * disc packed with hundreds of tiny florets in sunflower spirals, the outer
 * ones dusted with pollen. Its stalk runs along -y.
 *
 * @param radius - The radius of the disc
 * @param open - How far the head has opened, from a bud (0) to full bloom (1)
 * @param seed - Which head this is
 */
export function Bloom({
  open = 1,
  radius,
  seed = 1,
}: {
  readonly open?: number;
  readonly radius: number;
  readonly seed?: number;
}) {
  const built = useMemo(() => {
    const head = growHead({ florets: 320, open, radius, rays: 21, seed });
    const bud = new ConeGeometry(0.42, 1, 6);
    bud.rotateZ(-Math.PI / 2);
    bud.translate(0.5, 0, 0);
    const skin = new MeshPhysicalMaterial({ roughness: 0.7, sheen: 0.4 });
    return {
      bud,
      florets: leavesOf({
        blade: bud,
        deep: FLORA_COLORS.floretDark,
        leaves: head.florets,
        material: skin,
        sun: FLORA_COLORS.floretPollen,
      }),
      head,
      skin,
    };
  }, [open, radius, seed]);

  useEffect(
    () => () => {
      built.bud.dispose();
      built.florets.dispose();
      built.skin.dispose();
    },
    [built]
  );

  return (
    <group>
      <mesh castShadow position={[0, -radius * 0.2, 0]} scale={[1, 0.5, 1]}>
        <sphereGeometry args={[radius, 32, 16]} />
        <SurfaceMaterial
          color={FLORA_COLORS.bractGreen}
          repeat={[3, 2]}
          roughness={0.7}
          surface="leaf"
        />
      </mesh>
      <primitive object={built.florets} />
      <Foliage
        blade={RAY}
        deep={FLORA_COLORS.petalRay}
        leaves={built.head.rays}
        sun={FLORA_COLORS.petalTip}
        sway={0.05}
      />
      <Foliage
        blade={BRACT}
        deep={FLORA_COLORS.bractGreen}
        leaves={built.head.bracts}
        sun={FLORA_COLORS.stemGreen}
        sway={0.02}
      />
    </group>
  );
}
