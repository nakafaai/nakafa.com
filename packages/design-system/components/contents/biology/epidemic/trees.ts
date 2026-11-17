import {
  fade,
  litBall,
  mix,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { getColor } from "@repo/design-system/lib/color";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { Array as Arr, Order } from "effect";
import type p5 from "p5";

/**
 * The four shade trees of the town square seen from above in the morning sun
 * from the upper left: each canopy a soft-edged mass of leaf clusters, dark
 * on the side away from the sun and pale toward it, casting a dappled shadow
 * to the lower right. Each painter takes the canvas point of the fountain and
 * the pixels per metre, and places the trees from there.
 */

/** The four shade trees, in metres from the fountain, and their canopy radius. */
const TREES = [
  [-26, -16],
  [26, -16],
  [-26, 16],
  [26, 16],
] as const;
const CANOPY = 3.6;

/** The shadows' ink: near-black, faded where it is drawn. */
const SHADE = getColor("ZINC", 950);

/** The 2D context under a p5 canvas or layer, which carries gradients. */
function context(sketch: p5) {
  const drawing = sketch.drawingContext;
  return drawing instanceof CanvasRenderingContext2D ? drawing : undefined;
}

/** Each canopy's leaf clusters, in metres from its trunk, back to front toward the sun. */
function clustersOf(tree: number) {
  return Arr.sortWith(
    Arr.map(Arr.range(0, 55), (cluster) => {
      const angle = hashUnit(tree * 50 + cluster, 31) * Math.PI * 2;
      const reach =
        Math.sqrt(hashUnit(tree * 50 + cluster, 32)) * CANOPY * 0.76;
      const x = Math.cos(angle) * reach;
      const y = Math.sin(angle) * reach;
      return {
        // How far the cluster sits toward the sun at the upper left, from -1 to 1.
        lit: -(x + y) / (CANOPY * 1.1),
        radius: CANOPY * (0.17 + hashUnit(tree * 50 + cluster, 33) * 0.12),
        x,
        y,
      };
    }),
    (cluster) => cluster.lit,
    Order.Number
  );
}

/** The dappled shadow each canopy casts to the lower right, softer at its edge. */
export function paintTreeShadows(
  layer: p5,
  centreX: number,
  centreY: number,
  scale: number
) {
  const drawing = context(layer);
  if (!drawing) {
    return;
  }
  Arr.forEach(TREES, ([treeX, treeY], tree) => {
    Arr.forEach(clustersOf(tree), (cluster) => {
      const x = centreX + (treeX + cluster.x + 1.8) * scale;
      const y = centreY + (treeY + cluster.y + 2.4) * scale;
      const radius = cluster.radius * 1.35 * scale;
      const shadow = drawing.createRadialGradient(x, y, 0, x, y, radius);
      shadow.addColorStop(0, fade(SHADE, 0.2));
      shadow.addColorStop(1, fade(SHADE, 0));
      drawing.save();
      drawing.fillStyle = shadow;
      drawing.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      drawing.restore();
    });
  });
}

/**
 * The tree canopies: a soft-edged mass of foliage casting a little shadow,
 * then leaf clusters from the shaded side to the sunlit one, each lit from
 * the upper left, and a scatter of single leaves catching the light.
 */
export function paintCanopies(
  layer: p5,
  centreX: number,
  centreY: number,
  scale: number
) {
  Arr.forEach(TREES, ([treeX, treeY], tree) => {
    const x = centreX + treeX * scale;
    const y = centreY + treeY * scale;
    withShadow(
      layer,
      {
        blur: scale * 1.2,
        color: fade(SHADE, 0.45),
        drop: scale * 0.5,
      },
      () => {
        layer.noStroke();
        layer.fill(ROAD_COLORS.foliageDark);
        layer.circle(x, y, CANOPY * 1.55 * scale);
      }
    );
    Arr.forEach(clustersOf(tree), (cluster) => {
      const light = (cluster.lit + 1) / 2;
      litBall(
        layer,
        {
          x: centreX + (treeX + cluster.x) * scale,
          y: centreY + (treeY + cluster.y) * scale,
        },
        cluster.radius * scale,
        {
          dark: mix(
            ROAD_COLORS.foliageShade,
            ROAD_COLORS.foliageDark,
            1 - light
          ),
          light: mix(
            ROAD_COLORS.foliage,
            ECOLOGY_COLORS.riceLeafPale,
            0.15 + light * 0.4
          ),
        }
      );
    });
    layer.noStroke();
    Arr.forEach(Arr.range(0, 160), (leaf) => {
      const angle = hashUnit(tree * 100 + leaf, 34) * Math.PI * 2;
      const reach = Math.sqrt(hashUnit(tree * 100 + leaf, 35)) * CANOPY * 0.85;
      const lx = Math.cos(angle) * reach;
      const ly = Math.sin(angle) * reach;
      layer.fill(
        lx + ly < 0
          ? fade(ECOLOGY_COLORS.riceLeafPale, 0.55)
          : fade(ROAD_COLORS.foliageDark, 0.6)
      );
      layer.ellipse(
        centreX + (treeX + lx) * scale,
        centreY + (treeY + ly) * scale,
        scale * 0.28,
        scale * 0.17
      );
    });
  });
}
