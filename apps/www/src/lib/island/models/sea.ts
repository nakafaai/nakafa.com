import { Array as Arr } from "effect";
import {
  box,
  type Face,
  loft,
  meters as m,
  mirrored,
  rgb,
  turned,
} from "@/lib/island/models/parts";

const BACK = rgb(0x3b_4a_5c);
const BELLY = rgb(0xdf_e6_ea);

/**
 * A young humpback whale at real scale (ADR 0047, D21): 13 m from its blunt
 * head to the notch of its flukes, facing +z with its back at y = 0, so it
 * swims with its back just breaking the sea. A slate back over a pale belly,
 * long pale flippers swept back, and wide flukes.
 */
export function whaleFaces(): readonly Face[] {
  const length = 13;
  const at = (share: number) => m(length * share - length / 2);
  const back = (share: number, width: number, depth: number, rise = 0) => ({
    high: m(rise),
    low: m(rise - depth * 0.45),
    width: m(width),
    z: at(share),
  });
  const belly = (share: number, width: number, depth: number, rise = 0) => ({
    high: m(rise - depth * 0.45),
    low: m(rise - depth),
    width: m(width * 0.92),
    z: at(share),
  });
  const shape = [
    [0.02, 0.5, 1.2, -0.3],
    [0.12, 1.15, 2.4, 0],
    [0.35, 1.45, 3.0, 0.1],
    [0.6, 1.1, 2.4, 0],
    [0.82, 0.45, 1.1, -0.2],
    [0.94, 0.22, 0.6, -0.3],
  ] as const;
  const flipper = turned(
    box([m(1.1), m(-1.9), m(-0.3)], [m(5.0), m(-1.75), m(0.5)], BELLY, 0),
    -0.5,
    [m(1.1), 0, 0]
  );
  const fluke = turned(
    box([m(0.1), m(-0.45), at(0.94)], [m(2.3), m(-0.3), at(1.02)], BACK),
    0.35,
    [0, 0, at(0.94)]
  );
  return [
    ...loft(
      Arr.map(shape, ([s, w, d, r]) => back(s, w, d, r)),
      BACK
    ),
    ...loft(
      Arr.map(shape, ([s, w, d, r]) => belly(s, w, d, r)),
      BELLY
    ),
    ...flipper,
    ...mirrored(flipper),
    ...fluke,
    ...mirrored(fluke),
    ...box([m(-0.08), m(0), at(0.62)], [m(0.08), m(0.35), at(0.68)], BACK, 0.6),
  ];
}
