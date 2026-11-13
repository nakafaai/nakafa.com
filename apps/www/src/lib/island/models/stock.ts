import { Schema } from "effect";
import {
  box,
  type Face,
  loft,
  meters as m,
  mirrored,
  rgb,
} from "@/lib/island/models/parts";

/** The farm's animals (ADR 0047, D21). */
export const Stock = Schema.Literals(["cow", "hen", "duck"]);
export type Stock = typeof Stock.Type;

const WHITE = rgb(0xf4_ef_e6);
const BLACK = rgb(0x2b_26_22);
const PINK = rgb(0xe6_a4_9a);
const HORN = rgb(0xe8_dc_c0);

/**
 * A dairy cow at real scale (ADR 0047, D21): 1.4 m at the shoulder and 2.4 m
 * from nose to tail, standing on the origin and facing +z. White with black
 * patches laid just over its sides, so they never pierce it, a pink muzzle and
 * udder, short horns and a tail.
 */
function cowFaces(): readonly Face[] {
  const leg = (x: number, z: number) =>
    box(
      [x - m(0.08), 0, z - m(0.08)],
      [x + m(0.08), m(0.75), z + m(0.08)],
      WHITE
    );
  const half = [
    ...leg(m(0.24), m(0.62)),
    ...leg(m(0.24), m(-0.62)),
    ...box([m(0.15), 0, m(0.53)], [m(0.33), m(0.1), m(0.71)], BLACK),
    ...box([m(0.15), 0, m(-0.71)], [m(0.33), m(0.1), m(-0.53)], BLACK),
    ...box([m(0.362), m(0.95), m(-0.3)], [m(0.372), m(1.25), m(0.25)], BLACK),
    ...box([m(0.12), m(1.52), m(1.0)], [m(0.2), m(1.56), m(1.08)], HORN),
    ...box([m(0.2), m(1.4), m(0.98)], [m(0.3), m(1.46), m(1.06)], WHITE),
  ];
  return [
    ...half,
    ...mirrored(half),
    ...loft(
      [
        { high: m(1.32), low: m(0.72), width: m(0.32), z: m(-0.85) },
        { high: m(1.4), low: m(0.7), width: m(0.36), z: m(-0.4) },
        { high: m(1.42), low: m(0.72), width: m(0.36), z: m(0.4) },
        { high: m(1.36), low: m(0.8), width: m(0.3), z: m(0.78) },
      ],
      WHITE
    ),
    ...box([m(-0.2), m(1.08), m(0.78)], [m(0.2), m(1.52), m(1.12)], WHITE),
    ...box([m(-0.16), m(1.06), m(1.12)], [m(0.16), m(1.28), m(1.2)], PINK),
    ...box([m(-0.11), m(0.6), m(-0.3)], [m(0.11), m(0.72), m(-0.08)], PINK),
    ...box([m(-0.04), m(0.6), m(-0.92)], [m(0.04), m(1.3), m(-0.85)], WHITE),
    ...box([m(-0.06), m(0.5), m(-0.94)], [m(0.06), m(0.6), m(-0.84)], BLACK),
  ];
}

/** A hen (red comb) or a duck (green head, wide bill), 45 cm tall, facing +z. */
function fowlFaces(kind: "hen" | "duck"): readonly Face[] {
  const body = kind === "hen" ? rgb(0xc9_8a_4a) : rgb(0xf2_ef_e8);
  const head = kind === "hen" ? body : rgb(0x2f_7a_4a);
  const bill = kind === "hen" ? rgb(0xf0_c0_40) : rgb(0xf0_90_30);
  const leg = rgb(0xe0_8a_30);
  return [
    ...box([m(0.03), 0, m(-0.01)], [m(0.05), m(0.14), m(0.01)], leg),
    ...box([m(-0.05), 0, m(-0.01)], [m(-0.03), m(0.14), m(0.01)], leg),
    ...loft(
      [
        { high: m(0.32), low: m(0.2), width: m(0.06), z: m(-0.17) },
        { high: m(0.34), low: m(0.13), width: m(0.11), z: m(-0.05) },
        { high: m(0.32), low: m(0.14), width: m(0.1), z: m(0.1) },
      ],
      body
    ),
    ...box([m(-0.06), m(0.3), m(0.05)], [m(0.06), m(0.45), m(0.17)], head),
    ...box(
      [m(-0.025), m(0.36), m(0.17)],
      [m(0.025), m(0.39), kind === "hen" ? m(0.22) : m(0.25)],
      bill
    ),
    ...(kind === "hen"
      ? box(
          [m(-0.015), m(0.45), m(0.08)],
          [m(0.015), m(0.5), m(0.15)],
          rgb(0xd8_3a_2c)
        )
      : []),
  ];
}

/** Each farm animal's faces. */
export function stockFaces(kind: Stock) {
  return kind === "cow" ? cowFaces() : fowlFaces(kind);
}
