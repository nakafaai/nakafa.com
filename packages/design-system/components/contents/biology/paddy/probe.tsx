import { useFrame } from "@react-three/fiber";
import {
  soilOxygen,
  surfaceOxygen,
} from "@repo/design-system/components/contents/biology/paddy/oxygen";
import { WATER_DEPTH } from "@repo/design-system/components/contents/biology/paddy/water";
import { PADDY_COLORS } from "@repo/design-system/lib/material/paddy";
import { Array as Arr } from "effect";
import type { RefObject } from "react";
import { useEffect, useMemo } from "react";
import { BufferAttribute, Color, PlaneGeometry } from "three";

/**
 * Where the measuring stake stands in the field, in front of the nearest
 * plants, how far it reaches above and below the soil surface, and how wide
 * it is, in metres.
 */
export const STAKE = {
  bottom: -0.25,
  top: 0.12,
  width: 0.016,
  x: -0.3,
  z: 0.42,
} as const;

/** The strip that shows the soil's oxygen, beside the stake. */
const STRIP = { offset: 0.016, rows: 160, width: 0.012 } as const;

/** The centimetre marks on the stake, from its zero at the soil surface down. */
const TICKS = Arr.map(Arr.range(0, Math.round(-STAKE.bottom * 100)), (cm) => ({
  cm,
  length: tickLength(cm),
}));

/** How long the tick at `cm` is, in metres: longest every ten centimetres. */
function tickLength(cm: number) {
  if (cm % 10 === 0) {
    return 0.011;
  }
  return cm % 5 === 0 ? 0.007 : 0.004;
}

/**
 * A fibreglass measuring stake pushed into the mud, zero at the soil surface,
 * a mark each centimetre down, longer every five and ten, seen through the
 * soil in the X-ray view.
 */
export function Stake() {
  return (
    <group position={[STAKE.x, 0, STAKE.z]}>
      <mesh position={[0, (STAKE.top + STAKE.bottom) / 2, 0]} receiveShadow>
        <boxGeometry
          args={[STAKE.width, STAKE.top - STAKE.bottom, STAKE.width * 0.2]}
        />
        <meshStandardMaterial color={PADDY_COLORS.tape} roughness={0.55} />
      </mesh>
      {Arr.map(TICKS, ({ cm, length }) => (
        <mesh
          key={cm}
          position={[
            -STAKE.width / 2 + length / 2,
            -cm / 100,
            STAKE.width * 0.1 + 0.0003,
          ]}
        >
          <planeGeometry args={[length, cm % 10 === 0 ? 0.0012 : 0.0007]} />
          <meshBasicMaterial color={PADDY_COLORS.tapeInk} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The soil's oxygen down beside the stake, as an oxygen probe would read it: a strip
 * that glows blue as bright as the oxygen there, from the floodwater's
 * surface, or the soil's when drained, down past the roots. The values come
 * from the model, eased between drained and flooded.
 */
export function OxygenStrip({ flood }: { readonly flood: RefObject<number> }) {
  const { geometry, tones } = useMemo(() => {
    const strip = new PlaneGeometry(STRIP.width, 1, 1, STRIP.rows);
    const count = strip.getAttribute("position").count;
    strip.setAttribute(
      "color",
      new BufferAttribute(new Float32Array(count * 3), 3)
    );
    return {
      geometry: strip,
      tones: {
        none: new Color(PADDY_COLORS.reducedDark).multiplyScalar(0.6),
        paint: new Color(),
        rich: new Color(PADDY_COLORS.oxygen),
      },
    };
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const top = WATER_DEPTH * flood.current;
    const positions = geometry.getAttribute("position");
    const colors = geometry.getAttribute("color");
    Arr.forEach(Arr.range(0, positions.count - 1), (index) => {
      const row = Math.floor(index / 2) / STRIP.rows;
      const y = top + (STAKE.bottom - top) * row;
      positions.setY(index, y);
      const depth = -y;
      const oxygen =
        depth < 0
          ? surfaceOxygen("flooded")
          : soilOxygen("drained", depth) +
            (soilOxygen("flooded", depth) - soilOxygen("drained", depth)) *
              flood.current;
      tones.paint.lerpColors(tones.none, tones.rich, oxygen);
      colors.setXYZ(index, tones.paint.r, tones.paint.g, tones.paint.b);
    });
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    geometry.computeBoundingSphere();
  });

  return (
    <mesh geometry={geometry} position={[STAKE.x + STRIP.offset, 0, STAKE.z]}>
      <meshStandardMaterial
        emissiveIntensity={0}
        roughness={0.5}
        vertexColors
      />
    </mesh>
  );
}
