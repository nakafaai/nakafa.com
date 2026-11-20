/**
 * The parts of an adult human heart and their sizes, in centimetres, seen
 * from the front: x runs to the viewer's right (the body's left), y up and z
 * toward the viewer. The field module builds the specimen from them, cut
 * open from the front as a dissection shows it, so the four chambers, the
 * septum and the valves lie open.
 *
 * Proportions follow OpenStax Anatomy and Physiology 2e, 19.1 (about 12 cm
 * long, 8 cm wide and 6 cm thick) and the normal adult values of Lang et al.
 * (Eur Heart J Cardiovasc Imaging 2015;16:233-271): a left ventricular
 * cavity about 4.6 cm across in diastole (Table 2) with septum and free wall
 * 0.6 to 1.0 cm thick (Table 6), a right ventricular wall 0.1 to 0.5 cm
 * (Table 8), an aortic annulus of 2.3 to 2.6 cm, sinuses of 3.0 to 3.4 cm
 * and a sinotubular junction of 2.6 to 2.9 cm (Table 14).
 */

import { Schema } from "effect";

/** A point or a direction, in centimetres. */
export type Point = readonly [number, number, number];

/**
 * How far the heart's long axis leans from the vertical toward the body's
 * left, in radians: the apex lies to the left of the sternum (OpenStax 19.1).
 */
const LEAN = (27 * Math.PI) / 180;

/** The long axis, from the base toward the apex. */
export const AXIS: Point = [Math.sin(LEAN), -Math.cos(LEAN), 0];

/** Across the heart in the frontal plane, toward the body's left. */
export const ACROSS: Point = [Math.cos(LEAN), Math.sin(LEAN), 0];

/** A point given along the long axis (`along`, from the plane of the atrioventricular valves), across it and in depth. */
export function place(along: number, across: number, depth: number): Point {
  return [
    along * AXIS[0] + across * ACROSS[0],
    along * AXIS[1] + across * ACROSS[1],
    depth,
  ];
}

/** An ellipsoid aligned with the heart's axes: its centre and its three radii. */
const EllipsoidSchema = Schema.Struct({
  across: Schema.Finite,
  along: Schema.Finite,
  depth: Schema.Finite,
  radii: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
});
export type Ellipsoid = typeof EllipsoidSchema.Type;

/** A vessel or a channel: points along its middle with the radius of its lumen at each. */
export type Path = readonly (readonly [number, number, number, number])[];

/**
 * The cavity of the left ventricle in diastole: 4.6 cm across, about 7 cm
 * from the mitral annulus to the apex (Lang 2015, Table 2).
 */
export const LEFT_CAVITY: Ellipsoid = {
  across: 1.25,
  along: 3.3,
  depth: -0.1,
  radii: [3.6, 2.3, 2.15],
};

/** The left ventricle's outer surface: a wall 0.85 cm thick, 1 cm at the apex. */
export const LEFT_WALL: Ellipsoid = {
  across: 1.25,
  along: 3.5,
  depth: -0.1,
  radii: [4.45, 3.15, 3.0],
};

/** The right ventricle's cavity before the septum bulges into it, 3.3 cm across at its base (Lang 2015, Table 8). */
export const RIGHT_CAVITY: Ellipsoid = {
  across: -2.05,
  along: 3.0,
  depth: 0.5,
  radii: [3.5, 1.85, 2.45],
};

/** How thick the right ventricle's free wall is, in centimetres: 3 ± 1 mm (Lang 2015, Table 8). */
export const RIGHT_WALL = 0.36;

/** The atria: their cavities, and the thickness of their thin walls. */
export const RIGHT_ATRIUM: Ellipsoid = {
  across: -2.75,
  along: -2.0,
  depth: -0.7,
  radii: [2.05, 1.7, 1.85],
};
export const LEFT_ATRIUM: Ellipsoid = {
  across: 3.8,
  along: -1.55,
  depth: -1.5,
  radii: [1.5, 1.75, 1.5],
};
/**
 * The atrial wall, in centimetres: 2 to 3 mm in life, drawn at 3 mm so the
 * mesh, whose cells are 2 mm wide, never breaks it.
 */
export const ATRIAL_WALL = 0.3;

/**
 * The base of the heart round the valve plane, where the fibrous skeleton
 * holds the four valve rings and the atria meet the ventricles.
 */
export const BASE: Ellipsoid = {
  across: -0.3,
  along: -0.2,
  depth: -0.35,
  radii: [1.7, 3.7, 2.7],
};

/** The atrioventricular orifices: centre on the valve plane, radius, and the depth of the ring. */
export const MITRAL = { across: 1.7, along: -0.05, depth: -0.45, radius: 1.35 };
export const TRICUSPID = {
  across: -2.35,
  along: 0.15,
  depth: 0.05,
  radius: 1.55,
};

/**
 * The aorta, from its annulus through the sinuses, the sinotubular junction
 * and the ascending aorta, over the arch and down behind the heart. Radii are
 * of the lumen (Lang 2015, Table 14); the wall is 0.2 cm.
 */
export const AORTA: Path = [
  [-0.95, 0.75, 0.3, 1.15],
  [-1.15, 1.7, 0.3, 1.5],
  [-1.3, 2.7, 0.3, 1.3],
  [-1.5, 4.6, 0.2, 1.35],
  [-0.8, 6.9, -0.7, 1.3],
  [0.5, 7.9, -2.0, 1.25],
  [2.0, 7.4, -3.4, 1.15],
  [3.0, 5.5, -4.3, 1.1],
  [3.2, 2.8, -4.6, 1.05],
];

/** The right ventricle's outflow and the pulmonary trunk to its fork under the arch, about 5 cm long and 3 cm wide. */
export const PULMONARY: Path = [
  [-1.6, -1.2, 1.2, 1.15],
  [-0.5, 0.9, 2.1, 1.05],
  [0.8, 2.6, 2.1, 1.2],
  [1.2, 4.0, 1.0, 1.3],
  [1.0, 4.9, -0.6, 1.2],
];

/** Where the pulmonary valve sits in the trunk, as a share of its path. */
export const PULMONARY_VALVE = 2;

/** The left and right pulmonary arteries, from the fork. */
export const LEFT_PULMONARY: Path = [
  [1.0, 4.9, -0.6, 1.0],
  [3.1, 5.7, -1.7, 0.95],
  [5.1, 6.0, -2.4, 0.9],
];
export const RIGHT_PULMONARY: Path = [
  [1.0, 4.9, -0.6, 1.0],
  [-1.0, 5.4, -2.9, 0.95],
  [-3.4, 5.1, -3.3, 0.9],
  [-5.0, 4.9, -3.4, 0.85],
];

/** The branches of the arch: brachiocephalic trunk, left common carotid and left subclavian arteries. */
export const BRANCHES: readonly Path[] = [
  [
    [-0.55, 7.5, -0.95, 0.6],
    [-1.5, 9.3, -0.8, 0.58],
    [-2.0, 10.8, -0.7, 0.55],
  ],
  [
    [0.55, 8.3, -1.85, 0.38],
    [0.75, 9.9, -1.8, 0.37],
    [0.85, 11.0, -1.7, 0.36],
  ],
  [
    [1.6, 8.0, -2.85, 0.48],
    [2.4, 9.6, -3.0, 0.46],
    [3.0, 10.6, -3.0, 0.45],
  ],
];

/** The venae cavae, about 2 cm wide, entering the right atrium from above and below. */
export const SUPERIOR_CAVA: Path = [
  [-3.35, 2.4, -0.9, 0.95],
  [-3.45, 4.8, -1.0, 0.95],
  [-3.5, 7.6, -1.1, 0.95],
];
export const INFERIOR_CAVA: Path = [
  [-2.9, -1.2, -1.3, 1.1],
  [-2.8, -3.6, -1.6, 1.1],
  [-2.75, -5.4, -1.7, 1.05],
];

/** The four pulmonary veins entering the back of the left atrium. */
export const PULMONARY_VEINS: readonly Path[] = [
  [
    [1.4, 3.3, -2.3, 0.65],
    [-1.0, 3.3, -3.4, 0.62],
    [-2.8, 3.4, -3.9, 0.6],
  ],
  [
    [1.4, 2.3, -2.3, 0.65],
    [-1.0, 1.8, -3.4, 0.62],
    [-2.8, 1.6, -3.9, 0.6],
  ],
  [
    [3.3, 3.7, -2.4, 0.62],
    [4.8, 4.2, -3.0, 0.6],
    [5.7, 4.4, -3.2, 0.58],
  ],
  [
    [3.3, 2.5, -2.4, 0.62],
    [4.8, 2.4, -3.1, 0.6],
    [5.7, 2.3, -3.3, 0.58],
  ],
];

/** The outflow of the left ventricle, from its cavity up to the aortic annulus. */
export const LEFT_OUTFLOW: Path = [
  [0.6, -1.6, 0.25, 1.05],
  [-0.6, 0.0, 0.3, 1.05],
  [-0.95, 0.75, 0.3, 1.1],
];

/**
 * The papillary muscles and the moderator band, from the ventricular wall
 * to their tips, with their radius at each end (OpenStax 19.1): two in the
 * left ventricle, the anterior one cut through, and the anterior and
 * posterior ones of the right ventricle, the band crossing from the septum.
 */
export const PAPILLARY = {
  leftBack: { root: place(5.6, 1.9, -1.55), tip: place(3.3, 1.75, -0.75) },
  leftFront: { root: place(5.4, 2.4, 1.2), tip: place(3.2, 2.0, 0.5) },
  rightBack: { root: place(4.3, -3.0, -1.3), tip: place(2.6, -2.7, -0.55) },
  rightFront: { root: place(4.5, -3.5, 0.9), tip: place(2.8, -3.0, 0.4) },
} as const;
export const PAPILLARY_RADII = [0.5, 0.26] as const;
export const MODERATOR: Path = [
  [...place(4.4, -1.6, 0.1), 0.26],
  [...place(4.7, -3.3, 0.6), 0.24],
];

/**
 * Wall thickness of the great arteries and veins, in centimetres: the aorta's
 * wall is 2 to 4 mm thick, a vena cava's 1 to 2 mm, drawn at 3 mm so the
 * mesh's 2 mm cells never break it.
 */
export const ARTERIAL_WALL = 0.32;
export const VENOUS_WALL = 0.3;

/** How softly joined parts of the outer surface merge, in centimetres. */
export const MERGE = 0.55;
