import { Array as Arr } from "effect";
import { ExtrudeGeometry, LatheGeometry, Shape, Vector2 } from "three";

export const MODEL_ORIGIN = [-0.055, 0, 0.01] as const;
export const BROMINE_ORIGIN = [0.185, 0, 0.015] as const;

/** How high the middle of the molecular model stands above the bench, and how long one angstrom of it is, in scene units. */
export const MODEL_HEIGHT = 0.14;
export const ANGSTROM = 0.046;

/** Dark anodised beveled rectangular specimen plinth resting on LabBench y = 0. */
export function createPlinthGeometry() {
  const halfW = 0.122;
  const halfD = 0.056;
  const r = 0.008;
  const shape = new Shape();
  shape.moveTo(-halfW + r, -halfD);
  shape.lineTo(halfW - r, -halfD);
  shape.quadraticCurveTo(halfW, -halfD, halfW, -halfD + r);
  shape.lineTo(halfW, halfD - r);
  shape.quadraticCurveTo(halfW, halfD, halfW - r, halfD);
  shape.lineTo(-halfW + r, halfD);
  shape.quadraticCurveTo(-halfW, halfD, -halfW, halfD - r);
  shape.lineTo(-halfW, -halfD + r);
  shape.quadraticCurveTo(-halfW, -halfD, -halfW + r, -halfD);

  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    depth: 0.015,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.003, 0);
  return geo;
}

/** Turned round-bottom borosilicate bromine-water test tube (y = 0.010..0.168). */
export function createBromineTubeGeometry() {
  const outerR = 0.0165;
  const innerR = 0.0149;
  const centerY = 0.0265;
  const outerArc = Arr.makeBy(10, (index) => {
    const theta = (index / 9) * (Math.PI / 2);
    return new Vector2(
      Math.max(0.0004, Math.sin(theta) * outerR),
      centerY - Math.cos(theta) * outerR
    );
  });
  const innerArc = Arr.makeBy(10, (index) => {
    const theta = ((9 - index) / 9) * (Math.PI / 2);
    return new Vector2(
      Math.max(0.0004, Math.sin(theta) * innerR),
      centerY - Math.cos(theta) * innerR
    );
  });
  const lip = [
    new Vector2(outerR, 0.163),
    new Vector2(0.0195, 0.167),
    new Vector2(0.0185, 0.1685),
    new Vector2(innerR, 0.164),
  ];
  return new LatheGeometry([...outerArc, ...lip, ...innerArc], 48);
}

/** Turned borosilicate dropper tip positioned above the bromine test tube (local y = 0..0.068). */
export function createDropperGeometry() {
  const profile = Arr.map(
    [
      [0.0014, 0],
      [0.002, 0.01],
      [0.0048, 0.026],
      [0.0056, 0.064],
      [0.0072, 0.067],
      [0.0044, 0.064],
      [0.004, 0.025],
      [0.0009, 0.002],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(profile, 32);
}

/** Turned bromine droplet teardrop geometry. */
export function createBromineDropGeometry() {
  const profile = Arr.map(
    [
      [0.0002, -0.005],
      [0.0028, -0.0042],
      [0.0042, -0.002],
      [0.0038, 0.0008],
      [0.0022, 0.0036],
      [0.0008, 0.006],
      [0.0002, 0.0072],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(profile, 22);
}
