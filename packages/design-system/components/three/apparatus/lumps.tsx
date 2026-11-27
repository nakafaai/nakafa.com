import { heapOf } from "@repo/design-system/components/three/apparatus/heap";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { Array as Arr } from "effect";
import { useMemo } from "react";

/**
 * A heap of a broken solid lying on a floor at y = 0: marble chips, metal
 * granules or a powder, each piece a rough faceted lump. Stand it on the
 * floor of the vessel it is in.
 *
 * @example
 * <Lumps color={marble} count={6} size={0.009} />
 *
 * @param color - The colour of the solid
 * @param count - How many pieces there are
 * @param size - How large a piece is across, in metres
 */
export function Lumps({
  color,
  count,
  size,
}: {
  readonly color: string;
  readonly count: number;
  readonly size: number;
}) {
  const heap = useMemo(() => heapOf(count, size), [count, size]);
  return (
    <group>
      {Arr.map(heap, (piece, index) => (
        <mesh
          castShadow
          key={String(index)}
          position={piece.at}
          rotation={piece.turn}
          scale={piece.scale}
        >
          <dodecahedronGeometry args={[size * 0.62, 0]} />
          <SurfaceMaterial
            bump={0.8}
            color={color}
            roughness={0.9}
            surface="stone"
          />
        </mesh>
      ))}
    </group>
  );
}
