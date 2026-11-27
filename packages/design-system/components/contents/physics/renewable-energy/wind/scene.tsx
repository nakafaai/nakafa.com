import {
  landGeometry,
  SITE_GROUND,
  SITE_RISES,
} from "@repo/design-system/components/contents/physics/renewable-energy/wind/land";
import type { Site } from "@repo/design-system/components/contents/physics/renewable-energy/wind/site";
import {
  ROTOR_RADIUS,
  SITE_WIND,
} from "@repo/design-system/components/contents/physics/renewable-energy/wind/site";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Airflow } from "@repo/design-system/components/three/energy/airflow";
import { Turbine } from "@repo/design-system/components/three/energy/turbine";
import { Sea } from "@repo/design-system/components/three/stage/sea";
import { useGround } from "@repo/design-system/components/three/stage/terrain";
import { Array as Arr } from "effect";
import { Suspense, useEffect, useMemo } from "react";

/** How wide one tile of the ground's texture lies, in scene units. */
const TILE = 1;

/** One rise of the site's land, painted as the ground the stage lays round it. */
function Rise({
  rise,
  site,
}: {
  readonly rise: (typeof SITE_RISES)[Site][number];
  readonly site: Site;
}) {
  const tiles = (2 * rise.land.radius) / TILE;
  const { bump, map, patches } = useGround(SITE_GROUND[site].ground, [
    tiles,
    tiles,
  ]);
  const geometry = useMemo(() => landGeometry(rise.land), [rise.land]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[rise.at[0], rise.at[1], rise.at[2]]}
      receiveShadow
    >
      <meshStandardMaterial
        aoMap={patches}
        bumpMap={bump}
        bumpScale={0.35}
        map={map}
        metalness={0}
        roughness={0.94}
      />
    </mesh>
  );
}

/**
 * The turbine at its site, in rotor radii: the land the site gives it, the
 * sea in front of the coast, and the wind through the rotor at the site's
 * speed, which sets how fast the rotor turns.
 */
export function WindScene({ site }: { readonly site: Site }) {
  const place = SITE_GROUND[site];

  return (
    <group>
      <Turbine metres={ROTOR_RADIUS} radius={1} wind={SITE_WIND[site]} />
      <CameraBounds exclude>
        <Airflow metres={ROTOR_RADIUS} radius={1} wind={SITE_WIND[site]} />
        {Arr.map(SITE_RISES[site], (rise) => (
          <Rise key={rise.at[0]} rise={rise} site={site} />
        ))}
        {"sea" in place ? (
          <Suspense fallback={null}>
            <Sea level={place.sea} swell={1.8} />
          </Suspense>
        ) : null}
      </CameraBounds>
    </group>
  );
}
