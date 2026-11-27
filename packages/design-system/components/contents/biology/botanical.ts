import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Schema } from "effect";
import type { Vector3 } from "three";
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  LatheGeometry,
  SphereGeometry,
  Vector2,
} from "three";

const LaminaSpecSchema = Schema.Struct({
  baseTaper: Schema.Finite,
  cols: Schema.Finite,
  cup: Schema.Finite,
  droop: Schema.Finite,
  length: Schema.Finite,
  midribCrease: Schema.Finite,
  notchDepth: Schema.Finite,
  rows: Schema.Finite,
  ruffleAmp: Schema.Finite,
  ruffleFreq: Schema.Finite,
  serrationAmp: Schema.Finite,
  serrationTeeth: Schema.Finite,
  tipPower: Schema.Finite,
  width: Schema.Finite,
});

type LaminaSpec = typeof LaminaSpecSchema.Type;

const FruitSpecSchema = Schema.Struct({
  height: Schema.Finite,
  radialSegments: Schema.Finite,
  radius: Schema.Finite,
  ribDepth: Schema.Finite,
  ribs: Schema.Finite,
  rows: Schema.Finite,
});

type FruitSpec = typeof FruitSpecSchema.Type;

const NodeBandSchema = Schema.Struct({
  bulge: Schema.Finite,
  t: Schema.Finite,
  width: Schema.Finite,
});

type NodeBand = typeof NodeBandSchema.Type;

/**
 * Computes normalized organic half-width [0, 1] along a botanical lamina
 * (leaf blade, floral petal, sepal, or pitcher operculum) at longitudinal
 * parameter `u` in [0, 1].
 */
export function laminaHalfWidth(u: number, spec: LaminaSpec): number {
  const clamped = Math.min(1, Math.max(0, u));
  const env =
    Math.sin(clamped * Math.PI) ** spec.tipPower *
    (1 - spec.baseTaper * (clamped - 0.35));
  const toothPhase = clamped * spec.serrationTeeth * Math.PI * 2;
  const serration =
    spec.serrationAmp > 0 && clamped > 0.08 && clamped < 0.94
      ? 1 + spec.serrationAmp * (0.5 + 0.5 * Math.sin(toothPhase))
      : 1;
  return Math.max(0.015, env * serration);
}

/**
 * Builds a high-resolution UV-mapped 3D botanical lamina along +x (length)
 * centered on z (width) with upper surface facing +y. Supports transverse
 * cupping, central midrib V-crease, longitudinal arch/droop, apical notch,
 * marginal serration, and organic petal ruffling.
 */
export function buildLaminaGeometry(spec: LaminaSpec): BufferGeometry {
  const rows = Math.max(4, Math.round(spec.rows));
  const cols = Math.max(4, Math.round(spec.cols));

  const positions = Arr.flatMap(Arr.range(0, rows), (r) => {
    const u = r / rows;
    const halfW = spec.width * 0.5 * laminaHalfWidth(u, spec);
    return Arr.flatMap(Arr.range(0, cols), (c) => {
      const vNorm = c / cols;
      const v = vNorm * 2 - 1;
      const absV = Math.abs(v);
      const notch =
        spec.notchDepth > 0 && u > 0.72
          ? spec.notchDepth * ((u - 0.72) / 0.28) ** 2 * (1 - absV) ** 2
          : 0;
      const x = (u - notch) * spec.length;
      const z = v * halfW;
      const spineY =
        Math.sin(u * Math.PI) * spec.length * 0.08 - spec.droop * u * u;
      const cupLift = spec.cup * v * v * Math.sin(u * Math.PI);
      const crease = spec.midribCrease * (1 - Math.exp(-absV * 4.5));
      const edgeWeight = absV * absV * Math.sin(u * Math.PI);
      const ruffle =
        spec.ruffleAmp *
        edgeWeight *
        Math.sin(u * spec.ruffleFreq * Math.PI + (v > 0 ? 0.5 : -0.5));
      const y = spineY + cupLift + crease + ruffle;
      return [x, y, z];
    });
  });

  const uvs = Arr.flatMap(Arr.range(0, rows), (r) => {
    const u = r / rows;
    return Arr.flatMap(Arr.range(0, cols), (c) => [c / cols, u]);
  });

  const indices = Arr.flatMap(Arr.range(0, rows - 1), (r) =>
    Arr.flatMap(Arr.range(0, cols - 1), (c) => {
      const a = r * (cols + 1) + c;
      const b = a + cols + 1;
      return [a, b, a + 1, a + 1, b, b + 1];
    })
  );

  const geom = new BufferGeometry();
  geom.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3)
  );
  geom.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds a smoothly tapering curved botanical stem, petiole, tendril, or
 * filament along `controlPoints` with optional swollen leaf-node collars
 * and clean longitudinal UV coordinates.
 */
export function buildStemGeometry(
  controlPoints: readonly Vector3[],
  baseRadius: number,
  tipRadius: number,
  tubularSegments: number,
  radialSegments: number,
  nodeBands: readonly NodeBand[] = []
): BufferGeometry {
  const curve = new CatmullRomCurve3([...controlPoints]);
  const frames = curve.computeFrenetFrames(tubularSegments, false);

  const framePairs = Arr.zip(frames.normals, frames.binormals);
  const positions = Arr.flatMap(framePairs, ([normal, binormal], step) => {
    const t = step / tubularSegments;
    const center = curve.getPointAt(t);
    const baseR = baseRadius + (tipRadius - baseRadius) * t;
    const nodeFactor = Arr.reduce(nodeBands, 1, (acc, band) => {
      const dist = (t - band.t) / Math.max(0.01, band.width);
      return acc + band.bulge * Math.exp(-dist * dist);
    });
    const r = Math.max(0.001, baseR * nodeFactor);

    return Arr.flatMap(Arr.range(0, radialSegments), (seg) => {
      const theta = (seg / radialSegments) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const px = center.x + r * (cosT * normal.x + sinT * binormal.x);
      const py = center.y + r * (cosT * normal.y + sinT * binormal.y);
      const pz = center.z + r * (cosT * normal.z + sinT * binormal.z);
      return [px, py, pz];
    });
  });

  const uvs = Arr.flatMap(Arr.range(0, tubularSegments), (step) => {
    const v = step / tubularSegments;
    return Arr.flatMap(Arr.range(0, radialSegments), (seg) => [
      seg / radialSegments,
      v,
    ]);
  });

  const ringStride = radialSegments + 1;
  const indices = Arr.flatMap(Arr.range(0, tubularSegments - 1), (step) =>
    Arr.flatMap(Arr.range(0, radialSegments - 1), (seg) => {
      const a = step * ringStride + seg;
      const b = a + ringStride;
      return [a, b, a + 1, a + 1, b, b + 1];
    })
  );

  const geom = new BufferGeometry();
  geom.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3)
  );
  geom.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds a ribbed oblate botanical fruit (heirloom tomato / berry) with
 * gentle vertical carpel lobes and recessed stem/blossom poles.
 */
export function buildRibbedFruitGeometry(spec: FruitSpec): BufferGeometry {
  const rows = Math.max(8, Math.round(spec.rows));
  const segs = Math.max(12, Math.round(spec.radialSegments));

  const positions = Arr.flatMap(Arr.range(0, rows), (r) => {
    const v = r / rows;
    const phi = v * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const poleDimple = 1 - 0.16 * Math.abs(cosPhi) ** 4;
    const y = -cosPhi * spec.height * 0.5 * poleDimple;
    const profileR = spec.radius * sinPhi ** 0.86;

    return Arr.flatMap(Arr.range(0, segs), (c) => {
      const u = c / segs;
      const theta = u * Math.PI * 2;
      const ribMod =
        1 + spec.ribDepth * sinPhi * Math.cos(theta * spec.ribs + 0.3);
      const rad = Math.max(0.001, profileR * ribMod);
      return [Math.cos(theta) * rad, y, Math.sin(theta) * rad];
    });
  });

  const uvs = Arr.flatMap(Arr.range(0, rows), (r) => {
    const v = r / rows;
    return Arr.flatMap(Arr.range(0, segs), (c) => [c / segs, v]);
  });

  const ringStride = segs + 1;
  const indices = Arr.flatMap(Arr.range(0, rows - 1), (r) =>
    Arr.flatMap(Arr.range(0, segs - 1), (c) => {
      const a = r * ringStride + c;
      const b = a + ringStride;
      return [a, a + 1, b, a + 1, b + 1, b];
    })
  );

  const geom = new BufferGeometry();
  geom.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3)
  );
  geom.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds a classic rolled-lip weathered terracotta planter pot resting at y = 0.
 */
export function buildPlanterPotGeometry(
  bottomRadius: number,
  topRadius: number,
  height: number
): LatheGeometry {
  const rimOut = topRadius * 1.09;
  const rimIn = topRadius * 0.94;
  const pts = [
    new Vector2(0.002, 0),
    new Vector2(bottomRadius, 0),
    new Vector2(bottomRadius * 1.03, height * 0.08),
    new Vector2(topRadius * 0.97, height * 0.78),
    new Vector2(rimOut, height * 0.82),
    new Vector2(rimOut, height),
    new Vector2(rimIn, height),
    new Vector2(rimIn * 0.96, height * 0.8),
    new Vector2(0.002, height * 0.78),
  ];
  const geom = new LatheGeometry(pts, 40);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds an organic bumpy dark soil/peat mound geometry with deterministic
 * multi-frequency clod relief so no soil bed ever reads as a flat disc.
 */
export function buildSoilMoundGeometry(
  radius: number,
  height: number,
  seed: number
): BufferGeometry {
  const dome = new SphereGeometry(
    radius,
    36,
    16,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.48
  );
  const pos = dome.getAttribute("position");
  for (let i = 0; i < pos.count; i += 1) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const radial = Math.hypot(vx, vz) / Math.max(0.001, radius);
    const clod =
      valueNoise(vx * 14 + seed, vz * 14 + seed * 1.7, 32) * 0.65 +
      valueNoise(vx * 34 + seed * 3, vz * 34 - seed, 64) * 0.35;
    const edgePin = Math.max(0, 1 - radial * radial);
    const newY = (vy / radius) * height + clod * height * 0.48 * edgePin;
    pos.setXYZ(i, vx, Math.max(0, newY), vz);
  }
  dome.computeVertexNormals();
  return dome;
}
