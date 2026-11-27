import type { Placement } from "@repo/design-system/components/three/repeat";
import { Repeat } from "@repo/design-system/components/three/repeat";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { MutableHashMap, Option } from "effect";
import { useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

/**
 * What is engraved and inked on an instrument: its graduation marks and its
 * numerals. This file is the one seam between the instruments and how a
 * scale is printed, so the instruments never draw ink themselves.
 */

/** The height one numeral is painted at, in pixels: sharp when a phone looks straight at a scale. */
const GLYPH = 160;

/** How wide one character is next to its height. */
const ADVANCE = 0.6;

/** The numerals painted so far, shared by every instrument that shows them. */
const PAINTED = MutableHashMap.empty<string, CanvasTexture>();

/** How wide a numeral is next to its height. */
function aspectOf(text: string) {
  return text.length * ADVANCE + 0.1;
}

/** Paints one numeral in ink on a clear ground. */
function paintNumeral(text: string, ink: string) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(GLYPH * aspectOf(text));
  canvas.height = GLYPH;
  const context = canvas.getContext("2d");
  if (context !== null) {
    context.fillStyle = ink;
    context.font = `600 ${GLYPH * 0.86}px ui-sans-serif, system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, GLYPH * 0.54);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** The texture of one numeral in one ink, painted once and then shared. */
function numeralTexture(text: string, ink: string) {
  const key = `${ink} ${text}`;
  const known = MutableHashMap.get(PAINTED, key);
  if (Option.isSome(known)) {
    return known.value;
  }
  const painted = paintNumeral(text, ink);
  MutableHashMap.set(PAINTED, key, painted);
  return painted;
}

/**
 * The ink-filled graduation marks of one scale, drawn in a single call. Each
 * placement is one mark: where it stands, how it turns, and its width,
 * length and depth as its scale.
 *
 * @param placements - The marks, from the scale builders
 * @param ink - The colour of the ink
 */
export function Marks({
  ink = INSTRUMENT_COLORS.scaleInk,
  placements,
}: {
  readonly ink?: string;
  readonly placements: readonly Placement[];
}) {
  return (
    <Repeat placements={placements} shadows={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={ink} roughness={0.82} />
    </Repeat>
  );
}

/**
 * One numeral engraved beside a scale, `height` tall, centred on `at` and
 * lying in the plane its `turn` gives.
 *
 * @param at - Where the middle of the numeral stands
 * @param height - How tall the numeral is
 * @param ink - The colour of the ink
 * @param text - The numeral
 * @param turn - How the numeral's plane turns, as Euler angles
 */
export function Numeral({
  at,
  height,
  ink = INSTRUMENT_COLORS.scaleInk,
  text,
  turn = [0, 0, 0],
}: {
  readonly at: readonly [number, number, number];
  readonly height: number;
  readonly ink?: string;
  readonly text: string;
  readonly turn?: readonly [number, number, number];
}) {
  const texture = useMemo(() => numeralTexture(text, ink), [ink, text]);

  return (
    <mesh position={at} rotation={turn}>
      <planeGeometry args={[height * aspectOf(text), height]} />
      <meshStandardMaterial
        depthWrite={false}
        map={texture}
        polygonOffset
        polygonOffsetFactor={-2}
        roughness={0.82}
        transparent
      />
    </mesh>
  );
}
