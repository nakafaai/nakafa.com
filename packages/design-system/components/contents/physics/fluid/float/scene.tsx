import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { useOakGrain } from "@repo/design-system/components/contents/physics/bench/board";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import {
  Tank,
  TankLiquid,
} from "@repo/design-system/components/contents/physics/bench/vessel";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { useRef } from "react";
import type { Group } from "three";

/** The tank's inside, how deep its liquid stands, where its floor is, and the block's height. */
const WIDTH = 1.9;
const DEPTH = 0.9;
const LEVEL = 0.74;
const FLOOR = 0.046;
const BLOCK = 0.5;

/**
 * A wooden block floating in a glass tank of liquid, `share` of its height
 * under the surface, with the volume above and below the surface written
 * beside it. While the card plays the block bobs gently on the liquid.
 */
export function FloatingBlockScene({
  above,
  oil,
  share,
  under,
}: {
  readonly above: number;
  /** Whether the tank holds the lighter liquid instead of water. */
  readonly oil: boolean;
  /** The share of the block's height that lies under the surface. */
  readonly share: number;
  readonly under: number;
}) {
  const quantity = useQuantity();
  const playing = useVisualScene((card) => card.playing, false);
  const { grain, relief } = useOakGrain();
  const block = useRef<Group>(null);
  const clock = useRef(0);
  const surface = FLOOR + LEVEL;
  const rest = surface - share * BLOCK + BLOCK / 2;

  useVisualStop(() => {
    clock.current = 0;
    block.current?.position.setY(rest);
    block.current?.rotation.set(0, 0, 0);
  });

  useFrame((_, delta) => {
    if (!playing || block.current === null) {
      return;
    }
    clock.current += simulationStep(delta);
    block.current.position.y = rest + Math.sin(clock.current * 1.9) * 0.014;
    block.current.rotation.z = Math.sin(clock.current * 1.3) * 0.02;
  });

  return (
    <group>
      <BenchCamera
        narrow={[0.5, 1.9, 4.6]}
        target={[0, 0.56, 0]}
        wide={[0.5, 1.35, 3.1]}
      />
      <SeamlessBenchSurface />
      <group position={[0, rest, 0]} ref={block}>
        <RoundedBox
          args={[0.66, BLOCK, 0.5]}
          castShadow
          radius={0.015}
          smoothness={4}
        >
          <meshPhysicalMaterial
            bumpMap={relief}
            bumpScale={0.08}
            color={
              grain === null ? APPARATUS_COLORS.beechWood : getColor("WHITE")
            }
            map={grain}
            roughness={0.82}
          />
        </RoundedBox>
      </group>
      <TankLiquid
        color={oil ? APPARATUS_COLORS.oil : APPARATUS_COLORS.waterDeep}
        depth={DEPTH}
        level={LEVEL}
        width={WIDTH}
      />
      <Tank depth={DEPTH} height={1.12} width={WIDTH} />
      <Tag
        anchorX="left"
        position={[0.46, surface + (1 - share) * BLOCK * 0.6 + 0.06, 0.3]}
      >
        <InlineMath math={quantity(above, "\\text{ cm}^3", 0)} />
      </Tag>
      <Tag
        anchorX="left"
        position={[0.46, surface - share * BLOCK * 0.55, 0.3]}
      >
        <InlineMath math={quantity(under, "\\text{ cm}^3", 0)} />
      </Tag>
    </group>
  );
}
