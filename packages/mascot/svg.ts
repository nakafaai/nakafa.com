import { CANVAS, EYE_CLASS, type Part, type Picture } from "@repo/mascot/shape";
import { Array as Arr, Match } from "effect";

/** One layer as SVG markup. */
export function markup(part: typeof Part.Type): string {
  return Match.valueTags(part, {
    Ellipse: ({ cx, cy, fill, rx, ry, transform }) =>
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${
        transform === undefined ? "" : ` transform="${transform}"`
      }/>`,
    Eye: ({ cx, cy, fill, rx, ry }) =>
      `<ellipse class="${EYE_CLASS}" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`,
    Fade: ({ opacity, shapes }) =>
      `<g opacity="${opacity}">${Arr.join(Arr.map(shapes, markup), "")}</g>`,
    Line: ({ color, d, width }) =>
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`,
    Path: ({ d, fill, outline }) =>
      `<path d="${d}" fill="${fill}"${
        outline === undefined
          ? ""
          : ` stroke="${outline.color}" stroke-width="${outline.width}" stroke-linejoin="round"`
      }/>`,
    Polygon: ({ fill, points, rounding }) =>
      `<polygon points="${points}" fill="${fill}" stroke="${fill}" stroke-width="${rounding}" stroke-linejoin="round"/>`,
  });
}

/**
 * A picture as one standalone SVG document, for places that are not React: an
 * Open Graph image, an email. React draws the same picture from its parts.
 */
export function svg({ ground, parts, transform }: typeof Picture.Type) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}"><rect width="${CANVAS}" height="${CANVAS}" fill="${ground}"/><g transform="${transform}">${Arr.join(Arr.map(parts, markup), "")}</g></svg>`;
}
