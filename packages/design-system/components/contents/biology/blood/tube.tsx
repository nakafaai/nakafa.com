import { useRoute } from "@repo/design-system/components/contents/biology/blood/clock";
import { FallingDrop } from "@repo/design-system/components/contents/biology/blood/drop";
import {
  BLOOD_RELEASES,
  STEPS,
} from "@repo/design-system/components/contents/biology/blood/run";
import {
  columnX,
  rowZ,
  TILE,
  TIP_HEIGHT,
} from "@repo/design-system/components/contents/biology/blood/well";
import { ColumnLiquid } from "@repo/design-system/components/contents/chemistry/bench";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { SEROLOGY_COLORS } from "@repo/design-system/lib/material/serology";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { ExtrudeGeometry, Path, Shape, Vector2 } from "three";

/**
 * A K2EDTA blood collection tube, in metres: 13 mm across and 75 mm long,
 * filled with about 4 mL of whole blood, standing in a block to the right of
 * the vials.
 *
 * @see BD Vacutainer 367861: 4.0 mL, 13 x 75 mm, K2EDTA 7.2 mg, lavender
 * Hemogard closure, paper label, https://www.thomassci.com/p/vacutainer-edta-tubes
 */
const TUBE = { height: 0.075, radius: 0.0065, x: 0.088, z: -0.088 } as const;

/** How high the tube's round foot stands above the bench in its block, in metres. */
const TUBE_FOOT = 0.002;

/** The block the tube stands in, in metres. */
const BLOCK = { height: 0.016, size: 0.03 } as const;

/**
 * A small transfer pipette of low-density polyethylene, in metres: 115 mm
 * long, its stem 5 mm across tapering to the tip, and a bulb 12 mm across
 * at its top, as in the kit the job aid photographs.
 */
const PIPETTE = Arr.map(
  [
    [0.0004, 0],
    [0.0009, 0.0004],
    [0.0017, 0.01],
    [0.0026, 0.028],
    [0.0026, 0.078],
    [0.0042, 0.082],
    [0.0058, 0.088],
    [0.006, 0.098],
    [0.0056, 0.107],
    [0.004, 0.113],
    [0.0001, 0.115],
  ] as const,
  ([radius, height]) => new Vector2(radius, height)
);

/**
 * The tube's lavender closure, taken off and laid on its side: a shield 17 mm
 * across with a rounded crown, and the rubber stopper inside it, as radius
 * and height in metres along its axis.
 */
const CLOSURE = Arr.map(
  [
    [0.0001, 0],
    [0.0074, 0],
    [0.0083, 0.0009],
    [0.0085, 0.003],
    [0.0085, 0.0115],
    [0.0079, 0.012],
    [0.0066, 0.0123],
    [0.0061, 0.0128],
    [0.006, 0.0188],
    [0.0054, 0.0198],
    [0.0001, 0.02],
  ] as const,
  ([radius, height]) => new Vector2(radius, height)
);

/** How far the laid closure's axis stands above the bench: its widest radius. */
const CLOSURE_RADIUS = 0.0085;

/**
 * The tube of the sample's blood in its block, its lavender cap lying beside
 * it, and the pipette standing in the blood. While the card plays, the
 * pipette is drawn out, lets one drop of blood fall into each cavity of the
 * row under test, and goes back into the tube.
 */
export function BloodTube({ row }: { readonly row: number }) {
  const pipette = useRef<Group>(null);
  const points = useMemo(() => {
    const rest = [TUBE.x, TUBE_FOOT + 0.006, TUBE.z] as const;
    const raised = [TUBE.x, TUBE_FOOT + 0.09, TUBE.z] as const;
    const over = (column: number) =>
      [columnX(column), TILE.height + TIP_HEIGHT, rowZ(row)] as const;
    return [
      rest,
      raised,
      over(0),
      over(0),
      over(1),
      over(1),
      over(2),
      over(2),
      raised,
      rest,
    ] as const;
  }, [row]);
  useRoute(pipette, points, STEPS.pipette, 0.02);
  const block = useMemo(createBlock, []);
  useEffect(() => () => block.dispose(), [block]);

  return (
    <group>
      <group position={[TUBE.x, 0, TUBE.z]}>
        <mesh castShadow geometry={block} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.2}
            color={SEROLOGY_COLORS.stirrer}
            roughness={0.55}
          />
        </mesh>
        <group position={[0, TUBE_FOOT, 0]}>
          <mesh castShadow position={[0, TUBE.height / 2, 0]}>
            <cylinderGeometry
              args={[
                TUBE.radius,
                TUBE.radius,
                TUBE.height - TUBE.radius,
                32,
                1,
                true,
              ]}
            />
            <GlassMaterial color={BENCH_COLORS.glass} opacity={0.12} />
          </mesh>
          <ColumnLiquid
            bottom={0.0012}
            color={SEROLOGY_COLORS.bloodDeep}
            level={0.046}
            opacity={0.97}
            radius={TUBE.radius - 0.0008}
          />
          <mesh position={[0, 0.042, 0]}>
            <cylinderGeometry
              args={[
                TUBE.radius + 0.0001,
                TUBE.radius + 0.0001,
                0.034,
                32,
                1,
                true,
                2.3,
                3.6,
              ]}
            />
            <meshStandardMaterial
              color={SEROLOGY_COLORS.label}
              roughness={0.85}
            />
          </mesh>
        </group>
      </group>
      <group
        position={[TUBE.x - 0.03, CLOSURE_RADIUS, TUBE.z + 0.006]}
        rotation={[0, 0.5, Math.PI / 2]}
      >
        <mesh castShadow position={[0, -0.01, 0]} receiveShadow>
          <latheGeometry args={[CLOSURE, 40]} />
          <meshPhysicalMaterial
            clearcoat={0.4}
            color={SEROLOGY_COLORS.edta}
            roughness={0.5}
          />
        </mesh>
      </group>
      <group ref={pipette}>
        <mesh castShadow>
          <latheGeometry args={[PIPETTE, 32]} />
          <meshPhysicalMaterial
            clearcoat={0.3}
            color={SEROLOGY_COLORS.polythene}
            depthWrite={false}
            opacity={0.62}
            roughness={0.4}
            transparent
          />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.0021, 0.0007, 0.04, 16]} />
          <meshStandardMaterial
            color={SEROLOGY_COLORS.bloodDeep}
            roughness={0.3}
          />
        </mesh>
      </group>
      {Arr.map([0, 1, 2] as const, (column) => (
        <FallingDrop
          column={column}
          key={column}
          release={BLOOD_RELEASES[column]}
          row={row}
        >
          <meshPhysicalMaterial
            clearcoat={1}
            color={SEROLOGY_COLORS.bloodDeep}
            roughness={0.15}
          />
        </FallingDrop>
      ))}
    </group>
  );
}

/** The block the tube stands in: a white square pierced by the tube's hole, its edges rounded. */
function createBlock() {
  const half = BLOCK.size / 2;
  const outline = new Shape();
  outline.moveTo(-half, -half);
  outline.lineTo(half, -half);
  outline.lineTo(half, half);
  outline.lineTo(-half, half);
  outline.closePath();
  const hole = new Path();
  hole.absarc(0, 0, TUBE.radius + 0.0006, 0, Math.PI * 2, true);
  outline.holes = [hole];
  const geometry = new ExtrudeGeometry(outline, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.0012,
    bevelThickness: 0.0012,
    curveSegments: 16,
    depth: BLOCK.height - 0.0024,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0.0012, 0);
  return geometry;
}
