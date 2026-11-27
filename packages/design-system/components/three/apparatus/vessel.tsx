import { edgeProgram } from "@repo/design-system/components/three/apparatus/edge";
import type { Vessel as VesselAsk } from "@repo/design-system/components/three/apparatus/glass";
import {
  boreAt,
  filterOf,
  glassOf,
  levelOf,
  liquidOf,
  scaleOf,
} from "@repo/design-system/components/three/apparatus/glass";
import { Turn } from "@repo/design-system/components/three/form/part";
import {
  PrintFace,
  PrintSleeve,
} from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { Color, MeshPhysicalMaterial, MultiplyBlending } from "three";

/** The refractive index of borosilicate 3.3 laboratory glass (Schott Duran, n_d). */
const BOROSILICATE_IOR = 1.473;

/** How strongly a dilute coloured solution absorbs: it shows its own colour across about 55 mm. */
const SOLUTION = 18;

/**
 * How a liquid's body is drawn: it multiplies what is behind it by what it
 * lets through, and writes no depth, so whatever stands in it shows through.
 */
const FILTER = [
  {
    blending: MultiplyBlending,
    depthWrite: false,
    premultipliedAlpha: true,
    toneMapped: false,
    transparent: true,
  },
] as const;

/**
 * How much of its own colour a liquid scatters back to the eye: almost none
 * for clear water, and more the more of the light it stops, so a strong
 * solution keeps its colour against a dark bench.
 */
const SCATTER = { least: 0.03, most: 0.42 } as const;

/** The glass every vessel shares: clear, clear coated, and thick toward its outline. */
function createGlass() {
  const material = new MeshPhysicalMaterial({
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    color: LABWARE_COLORS.glass,
    depthWrite: false,
    ior: BOROSILICATE_IOR,
    metalness: 0,
    opacity: 0.06,
    roughness: 0.04,
    transparent: true,
  });
  const edgeTint = { value: new Color(LABWARE_COLORS.glassEdge) };
  material.onBeforeCompile = (program) => {
    program.uniforms.edgeTint = edgeTint;
    program.fragmentShader = edgeProgram(program.fragmentShader);
  };
  material.customProgramCacheKey = () => "apparatus-glass";
  return material;
}

/**
 * Borosilicate laboratory glass, as the material of a mesh: nearly clear
 * where it faces the eye and solid, faintly green, along its outline, where
 * the light crosses the most glass. One material per part, freed with it.
 */
export function Borosilicate() {
  const material = useMemo(createGlass, []);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive attach="material" object={material} />;
}

/**
 * A piece of laboratory glassware at its catalogue size, standing on the
 * bench at y = 0: borosilicate with a real wall, a thick base, a rolled rim
 * and, on a beaker, a spout toward +x, with its scale fired in white enamel
 * on the side that faces +z, each mark at the height the vessel holds that
 * volume. A vessel that `holds` something shows it at the level that volume
 * reaches, with the meniscus water draws up the glass and a colour as deep
 * as the vessel is wide. Its children stand inside it: an electrode, a
 * stirrer, a precipitate.
 *
 * @example
 * <Vessel capacity={250} holds={{ color: copperSulfate, volume: 120 }} kind="beaker" />
 *
 * @param capacity - The nominal capacity, in millilitres
 * @param holds - The liquid in it: its colour, its volume in millilitres, and how strongly it absorbs light for each metre of it
 * @param kind - What the vessel is
 */
export function Vessel({
  capacity,
  children,
  holds,
  kind,
}: {
  readonly capacity: number;
  readonly children?: ReactNode;
  readonly holds?: {
    readonly color: string;
    readonly strength?: number;
    readonly volume: number;
  };
  readonly kind: VesselAsk["kind"];
}) {
  const format = usePrintNumber();
  const vessel = useMemo(() => ({ capacity, kind }), [capacity, kind]);
  const glass = useMemo(() => glassOf(vessel), [vessel]);
  const scale = useMemo(
    () => scaleOf(vessel, LABWARE_COLORS.enamel, format),
    [format, vessel]
  );

  return (
    <group>
      {holds === undefined ? null : (
        <Liquid
          color={holds.color}
          outline={liquidOf(vessel, holds.volume)}
          strength={holds.strength ?? SOLUTION}
          width={2 * boreAt(vessel, levelOf(vessel, holds.volume) / 2)}
        />
      )}
      {children}
      <mesh castShadow renderOrder={2}>
        <Turn
          profile={glass.outline}
          spout={glass.spout}
          wall={[glass.wall, glass.base]}
        />
        <Borosilicate />
      </mesh>
      <group position={[0, scale.middle, 0]}>
        {scale.lean === 0 ? (
          <PrintSleeve
            radius={scale.radius}
            sheet={scale.sheet}
            stock="enamel"
          />
        ) : (
          <group
            position={[0, 0, scale.radius + 0.0004]}
            rotation={[-scale.lean, 0, 0]}
          >
            <PrintFace sheet={scale.sheet} stock="enamel" />
          </group>
        )}
      </group>
    </group>
  );
}

/**
 * A liquid standing in glass, as the outline of its body. A liquid has no
 * colour of its own surface: it takes out of the light that crosses it what
 * it absorbs, so its body filters whatever is behind it, more deeply the
 * wider it is, and only its wet surface reflects the room.
 *
 * @param color - The colour it leaves in the light
 * @param outline - Its body as radius and height, from its floor to its level
 * @param strength - How strongly it absorbs light, for each metre of it
 * @param width - How much of it the light crosses, in metres
 */
export function Liquid({
  color,
  outline,
  strength = SOLUTION,
  width,
}: {
  readonly color: string;
  readonly outline: readonly (readonly [number, number])[];
  readonly strength?: number;
  readonly width: number;
}) {
  const filter = useMemo(() => {
    const thin = new Color(color);
    return new Color(...filterOf([thin.r, thin.g, thin.b], strength, width));
  }, [color, strength, width]);
  const stopped = 1 - (filter.r + filter.g + filter.b) / 3;

  return (
    <group>
      <mesh renderOrder={1}>
        <Turn profile={outline} />
        <meshBasicMaterial args={FILTER} color={filter} />
      </mesh>
      <mesh renderOrder={1}>
        <Turn profile={outline} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.04}
          color={color}
          depthWrite={false}
          ior={1.333}
          metalness={0}
          opacity={SCATTER.least + SCATTER.most * stopped}
          roughness={0.06}
          transparent
        />
      </mesh>
    </group>
  );
}
