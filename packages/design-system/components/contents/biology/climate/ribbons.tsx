import { Billboard } from "@react-three/drei";
import {
  useFlowMaterial,
  useHaloMaterial,
  useTubes,
} from "@repo/design-system/components/contents/biology/climate/flow";
import {
  infraredRays,
  wavePoints,
} from "@repo/design-system/components/contents/biology/climate/rays";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { Array as Arr } from "effect";
import { useMemo } from "react";

/** How wide the glow is around a molecule that has just caught a ray. */
const HALO_SIZE = 0.32;

/**
 * The infrared the warm surface gives off at gas level `level`: warm wavy
 * ribbons that leave the ground, some escaping to space and fading, others
 * caught by a molecule, which glows and sends them on in a new direction.
 */
export function Ribbons({ level }: { readonly level: number }) {
  const rays = useMemo(() => infraredRays(level), [level]);
  const paths = useMemo(
    () =>
      Arr.flatMap(rays, (ray) =>
        Arr.map(ray.segments, (stretch) => ({
          fades: stretch.fades,
          length: stretch.length,
          offset: stretch.offset,
          points: wavePoints(stretch),
        }))
      ),
    [rays]
  );
  const absorbers = useMemo(
    () => Arr.getSomes(Arr.map(rays, (ray) => ray.absorber)),
    [rays]
  );
  const core = useTubes(paths, 0.011);
  const haze = useTubes(paths, 0.03);
  const bright = useFlowMaterial(ECOLOGY_COLORS.infrared, 2.4, 0.26, 0.75);
  const soft = useFlowMaterial(ECOLOGY_COLORS.infrared, 0.3, 0.26, 0.75);
  const halo = useHaloMaterial(ECOLOGY_COLORS.infrared, 0.65);

  return (
    <group>
      <mesh geometry={haze} material={soft} />
      <mesh geometry={core} material={bright} />
      <CameraBounds exclude>
        {Arr.map(absorbers, (absorber) => (
          <Billboard
            key={Arr.join(Arr.map(absorber, String), ",")}
            position={absorber}
          >
            <mesh material={halo}>
              <planeGeometry args={[HALO_SIZE, HALO_SIZE]} />
            </mesh>
          </Billboard>
        ))}
      </CameraBounds>
    </group>
  );
}
