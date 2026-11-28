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
import { useStage } from "@repo/design-system/components/three/stage/context";
import { Sea } from "@repo/design-system/components/three/stage/sea";
import {
  GROUND_REACHES,
  GroundMaterial,
} from "@repo/design-system/components/three/stage/terrain";
import { Array as Arr } from "effect";
import { Suspense, useEffect, useMemo } from "react";

/** How wide the stage lays one tile of its ground's texture, in reaches. */
const TILE_REACHES = 0.22;

/**
 * One rise of the site's land, painted exactly as the stage paints its own
 * ground: the same texture in the same place, the same material, and the
 * same fade into the haze, so a site's rises read as one piece of land with
 * no rim to see.
 */
function Rise({
  rise,
  site,
}: {
  readonly rise: (typeof SITE_RISES)[Site][number];
  readonly site: Site;
}) {
  const { reach } = useStage();
  const tiles = (2 * GROUND_REACHES) / TILE_REACHES;
  const geometry = useMemo(
    () => landGeometry(rise, 2 * GROUND_REACHES * reach),
    [reach, rise]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[rise.at[0], rise.at[1], rise.at[2]]}
      receiveShadow
      renderOrder={-10}
      userData={{ treatAsOpaque: true }}
    >
      <GroundMaterial kind={SITE_GROUND[site].ground} repeat={[tiles, tiles]} />
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
          <Rise
            key={`${rise.at[0]}:${rise.land.radius}`}
            rise={rise}
            site={site}
          />
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
