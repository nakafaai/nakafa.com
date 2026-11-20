import { useRoute } from "@repo/design-system/components/contents/biology/blood/clock";
import { FallingDrop } from "@repo/design-system/components/contents/biology/blood/drop";
import {
  SERUM_RELEASES,
  STEPS,
} from "@repo/design-system/components/contents/biology/blood/run";
import type { Serum } from "@repo/design-system/components/contents/biology/blood/serology";
import {
  columnX,
  rowZ,
  TILE,
  TIP_HEIGHT,
} from "@repo/design-system/components/contents/biology/blood/well";
import { ColumnLiquid } from "@repo/design-system/components/contents/chemistry/bench";
import {
  GlassMaterial,
  LiquidMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { SEROLOGY_COLORS } from "@repo/design-system/lib/material/serology";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { CylinderGeometry, DoubleSide, Vector2 } from "three";

/**
 * A 10 mL glass reagent vial, in metres: 24 mm across and 45 mm tall to the
 * top of its neck, the ISO 8362-1 size 10R, which the 10 mL dropper vials of
 * monoclonal antisera come in.
 *
 * @see ISO 8362-1, injection vials made of glass tubing, size 10R: d1 24.0 mm,
 * h1 45 mm.
 * @see J. Mitra & Co. instructions: the antibodies "are packed in 10 ml
 * dropper vial".
 */
const NECK = 0.041;

/** How far behind the tile's back edge the vials stand, in metres. */
const VIAL_Z = -TILE.length / 2 - 0.024;

/** How far the dropper's tip reaches down into its vial, in metres above the bench. */
const TIP_REST = 0.006;

/** The vial's outer wall, base to the lip of its threaded neck. */
const WALL = Arr.map(
  [
    [0.0005, 0],
    [0.0106, 0],
    [0.0117, 0.0007],
    [0.012, 0.0025],
    [0.012, 0.034],
    [0.0116, 0.0368],
    [0.0098, 0.0392],
    [0.0088, 0.0405],
    [0.0088, 0.045],
  ] as const,
  ([radius, height]) => new Vector2(radius, height)
);

/**
 * The dropper's white rubber bulb above its cap, as radius and height in
 * metres from the cap's foot: a collar, a straight body, and a rounded crown.
 */
const BULB = Arr.map(
  [
    [0.0045, 0.011],
    [0.0052, 0.0118],
    [0.0056, 0.0135],
    [0.0058, 0.016],
    [0.0058, 0.0205],
    ...Arr.map(Arr.range(1, 8), (step) => {
      const angle = (step / 8) * (Math.PI / 2);
      return [
        Math.max(0.0001, 0.0058 * Math.cos(angle)),
        0.0205 + 0.0052 * Math.sin(angle),
      ] as const;
    }),
  ] as const,
  ([radius, height]) => new Vector2(radius, height)
);

/** The screw cap, knurled with 36 ribs around its side as a polypropylene cap is moulded. */
function createCap() {
  const geometry = new CylinderGeometry(0.0092, 0.0094, 0.011, 144, 1);
  const position = geometry.getAttribute("position");
  for (const index of Arr.range(0, position.count - 1)) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const rib = 1 + 0.045 * Math.max(0, Math.cos(Math.atan2(x, z) * 36)) ** 3;
    position.setXYZ(index, x * rib, position.getY(index), z * rib);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** The tint and opacity of each serum in its vial. */
const SERA = {
  a: { color: SEROLOGY_COLORS.antiA, opacity: 0.92 },
  b: { color: SEROLOGY_COLORS.antiB, opacity: 0.9 },
  d: { color: SEROLOGY_COLORS.antiD, opacity: 0.3 },
} as const;

/**
 * The vial of one serum behind its column, with its dropper cap. While the
 * card plays, the dropper is drawn up, carried over the row under test, lets
 * one drop form and fall into its cavity, and goes back into the vial.
 */
export function Vial({
  column,
  row,
  serum,
}: {
  readonly column: number;
  readonly row: number;
  readonly serum: Serum;
}) {
  const x = columnX(column);
  const dropper = useRef<Group>(null);
  const points = useMemo(() => {
    const rest = [x, TIP_REST, VIAL_Z] as const;
    const raised = [x, TIP_REST + 0.046, VIAL_Z] as const;
    const over = [x, TILE.height + TIP_HEIGHT, rowZ(row)] as const;
    return [rest, raised, over, over, raised, rest] as const;
  }, [row, x]);
  useRoute(dropper, points, STEPS.droppers[column], 0.012);

  return (
    <group>
      <group position={[x, 0, VIAL_Z]}>
        <mesh castShadow>
          <latheGeometry args={[WALL, 48]} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.14} />
        </mesh>
        <ColumnLiquid
          bottom={0.0016}
          color={SERA[serum].color}
          level={0.033}
          opacity={SERA[serum].opacity}
          radius={0.0106}
        />
        <Wrapper />
        {Arr.map([0.0423, 0.0438] as const, (height) => (
          <mesh
            key={height}
            position={[0, height, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[0.0088, 0.000_35, 6, 40]} />
            <GlassMaterial color={BENCH_COLORS.glass} opacity={0.4} />
          </mesh>
        ))}
      </group>
      <group ref={dropper}>
        <Dropper serum={serum} />
      </group>
      <FallingDrop column={column} release={SERUM_RELEASES[column]} row={row}>
        <LiquidMaterial color={SERA[serum].color} opacity={0.9} />
      </FallingDrop>
    </group>
  );
}

/**
 * The vial's paper label, wrapped half way round its front, with three
 * printed lines of the reagent's name, clone and lot; the serum's colour
 * shows above and below it and through the bare back of the vial.
 */
function Wrapper() {
  return (
    <group position={[0, 0.015, 0]}>
      <mesh castShadow>
        <cylinderGeometry
          args={[0.012_08, 0.012_08, 0.018, 40, 1, true, -1.75, 3.5]}
        />
        <meshStandardMaterial
          color={SEROLOGY_COLORS.label}
          roughness={0.85}
          side={DoubleSide}
        />
      </mesh>
      {Arr.map([0.004, 0.0005, -0.003] as const, (height) => (
        <mesh key={height} position={[0, height, 0]}>
          <cylinderGeometry
            args={[
              0.012_12,
              0.012_12,
              height > 0.003 ? 0.0016 : 0.0008,
              40,
              1,
              true,
              -0.85,
              1.7,
            ]}
          />
          <meshStandardMaterial
            color={SEROLOGY_COLORS.labelInk}
            roughness={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A dropper cap, its origin at the tip: a glass pipette that holds a little
 * serum, the knurled polypropylene screw cap, and the white rubber bulb.
 */
function Dropper({ serum }: { readonly serum: Serum }) {
  const stem = NECK - TIP_REST;
  const cap = useMemo(createCap, []);
  useEffect(() => () => cap.dispose(), [cap]);
  return (
    <group>
      <mesh position={[0, stem / 2, 0]}>
        <cylinderGeometry args={[0.0021, 0.0011, stem, 20, 1, true]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.42} />
      </mesh>
      <mesh position={[0, 0.006, 0]}>
        <cylinderGeometry args={[0.0013, 0.0007, 0.011, 14]} />
        <LiquidMaterial
          color={SERA[serum].color}
          opacity={SERA[serum].opacity}
        />
      </mesh>
      <group position={[0, stem, 0]}>
        <mesh castShadow geometry={cap} position={[0, 0.0055, 0]}>
          <meshPhysicalMaterial
            clearcoat={0.3}
            color={SEROLOGY_COLORS.cap}
            roughness={0.45}
          />
        </mesh>
        <mesh castShadow>
          <latheGeometry args={[BULB, 32]} />
          <meshPhysicalMaterial
            clearcoat={0.2}
            clearcoatRoughness={0.5}
            color={SEROLOGY_COLORS.bulb}
            roughness={0.62}
          />
        </mesh>
      </group>
    </group>
  );
}
