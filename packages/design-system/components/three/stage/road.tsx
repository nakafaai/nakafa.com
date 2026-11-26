import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import {
  paintDashes,
  paintVerge,
} from "@repo/design-system/components/three/stage/grain";
import {
  GROUND_REACHES,
  groundTexture,
  HORIZON_FADE_INNER,
  HORIZON_FADE_OUTER,
  useGround,
  useHorizonFade,
} from "@repo/design-system/components/three/stage/terrain";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";

/** How far each layer of the road lies above the one under it, so none flickers through another. */
const LAYER = 0.004;

/** How wide a painted line is, in scene units. */
const LINE_WIDTH = 0.07;

/**
 * Half of a soft verge, for a strip beside the road: opaque at the road's
 * edge and clear at the ground's. `from` picks the half, 0 or 0.5.
 */
function verge(from: number) {
  const texture = groundTexture(paintVerge(64, 0.5), 1, 64, [1, 0.5]);
  texture.offset.set(0, from);
  return texture;
}

/**
 * A road along x on the lab's ground: a gravel shoulder that fades into the
 * ground, the asphalt, its two edge lines and its dashed centre line. It runs
 * past the lab into the haze in both directions, so it has no end to see.
 *
 * @param width - How wide the asphalt is
 * @param dash - How long a dash of the centre line is
 * @param spacing - From the start of one dash to the start of the next
 */
export function Road({
  dash,
  spacing,
  width,
}: {
  readonly dash: number;
  readonly spacing: number;
  readonly width: number;
}) {
  const { floor = 0, reach } = useStage();
  const length = 2 * GROUND_REACHES * reach;
  const asphalt = useGround("asphalt", [length / (width * 0.8), 1.25]);
  const shoulder = useGround("soil", [length / (width * 0.5), 0.7]);
  const marks = useMemo(
    () => ({
      dashes: groundTexture(paintDashes(64, dash / spacing), 64, 1, [
        length / spacing,
        1,
      ]),
      far: verge(0.5),
      near: verge(0),
    }),
    [dash, length, spacing]
  );

  useEffect(
    () => () => {
      marks.dashes.dispose();
      marks.far.dispose();
      marks.near.dispose();
    },
    [marks]
  );

  const paint = getColor("ZINC", 100);
  const horizonFade = useHorizonFade(
    HORIZON_FADE_INNER * reach,
    HORIZON_FADE_OUTER * reach
  );

  return (
    <CameraBounds exclude>
      <group position={[0, floor, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            key={side}
            position={[0, side * width * 0.675, LAYER]}
            receiveShadow
            renderOrder={-8}
          >
            <planeGeometry args={[length, width * 0.35]} />
            <meshStandardMaterial
              alphaMap={side === 1 ? marks.far : marks.near}
              bumpMap={shoulder.bump}
              bumpScale={0.8}
              depthWrite={false}
              map={shoulder.map}
              ref={horizonFade}
              roughness={0.96}
              transparent
            />
          </mesh>
        ))}
        <mesh position={[0, 0, LAYER * 2]} receiveShadow renderOrder={-7}>
          <planeGeometry args={[length, width]} />
          <meshStandardMaterial
            aoMap={asphalt.patches}
            aoMapIntensity={0.8}
            bumpMap={asphalt.bump}
            bumpScale={0.35}
            depthWrite
            map={asphalt.map}
            ref={horizonFade}
            roughness={0.86}
            transparent
          />
        </mesh>
        <mesh position={[0, 0, LAYER * 3]} receiveShadow renderOrder={-6}>
          <planeGeometry args={[length, LINE_WIDTH]} />
          <meshStandardMaterial
            alphaMap={marks.dashes}
            alphaTest={0.5}
            color={paint}
            depthWrite={false}
            ref={horizonFade}
            roughness={0.7}
            transparent
          />
        </mesh>
        <mesh
          position={[0, width / 2 - LINE_WIDTH * 1.6, LAYER * 3]}
          receiveShadow
          renderOrder={-6}
        >
          <planeGeometry args={[length, LINE_WIDTH]} />
          <meshStandardMaterial
            color={paint}
            depthWrite={false}
            ref={horizonFade}
            roughness={0.7}
            transparent
          />
        </mesh>
        <mesh
          position={[0, -width / 2 + LINE_WIDTH * 1.6, LAYER * 3]}
          receiveShadow
          renderOrder={-6}
        >
          <planeGeometry args={[length, LINE_WIDTH]} />
          <meshStandardMaterial
            color={paint}
            depthWrite={false}
            ref={horizonFade}
            roughness={0.7}
            transparent
          />
        </mesh>
      </group>
    </CameraBounds>
  );
}
