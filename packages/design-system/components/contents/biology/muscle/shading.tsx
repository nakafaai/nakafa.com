import { MICRONS } from "@repo/design-system/components/contents/biology/muscle/bundle";
import {
  RELAXED,
  THICK,
  THIN,
} from "@repo/design-system/components/contents/biology/muscle/debt";
import {
  CELL,
  NUCLEUS,
} from "@repo/design-system/components/contents/biology/muscle/nuclei";
import { MUSCLE_COLORS } from "@repo/design-system/lib/material/muscle";
import { useEffect, useMemo } from "react";
import { Color, MeshPhysicalMaterial } from "three";

/**
 * The PCG hash in GLSL ES 3.0 uint arithmetic, and a cell's number in
 * [0, 1), exactly as `nuclei.ts` computes them, so the nuclei the shader
 * draws are the ones the cut face shows.
 */
const HASH = /* glsl */ `
uint pcgHash(uint value) {
  uint state = value * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float cellUnit(uint fibre, uint row, uint column, uint salt) {
  return float(pcgHash(pcgHash(pcgHash(fibre * 7u + salt) + row) + column)) / 4294967296.0;
}
`;

const SIDE_VERTEX = /* glsl */ `
uniform float uMicrons;
uniform float uRelaxed;
attribute float aPhase;
attribute float aArc;
attribute float aColumn;
attribute float aFibre;
attribute float aKind;
varying float vAlong;
varying float vX;
varying float vArc;
varying float vColumn;
varying float vFibre;
varying float vKind;
`;

const SIDE_PLACE = /* glsl */ `
vAlong = position.x * uMicrons / uRelaxed + aPhase;
vX = position.x;
vArc = aArc;
vColumn = aColumn;
vFibre = aFibre;
vKind = aKind;
`;

const SIDE_FRAGMENT = /* glsl */ `
uniform float uSarcomere;
uniform float uThick;
uniform float uThin;
uniform float uBack;
uniform vec2 uCell;
uniform vec2 uNucleusHalf;
uniform vec3 uABand;
uniform vec3 uIBand;
uniform vec3 uNucleus;
varying float vAlong;
varying float vX;
varying float vArc;
varying float vColumn;
varying float vFibre;
varying float vKind;
${HASH}
`;

/**
 * The sarcolemma's surface: the cross-striation of the myofibrils showing
 * through it, A bands dark and I bands pale with the Z discs, H zone and M
 * line, drawn from the sarcomere length the scene sets, so the I band and
 * H zone narrow in contraction while the A band keeps its width. Where the
 * stripes would be finer than the screen can draw they fade to their mean.
 * Nuclei show through as elongated violet ovals, one to each cell of the
 * surface. A pale fibre is a fast, type II fibre, with less myoglobin.
 */
const SIDE_COLOUR = /* glsl */ `
float spread = fwidth(vAlong);
float place = abs(fract(vAlong) - 0.5) * uSarcomere;
float blur = max(spread * uSarcomere, 0.03);
float halfLength = uSarcomere * 0.5;
float aBand = 1.0 - smoothstep(uThick * 0.5 - blur, uThick * 0.5 + blur, place);
float hHalf = max(halfLength - uThin, 0.0);
float hZone = (1.0 - smoothstep(hHalf - blur, hHalf + blur, place)) * step(0.02, hHalf);
float zDisc = smoothstep(halfLength - 0.07 - blur, halfLength - 0.07 + blur, place);
float mLine = 1.0 - smoothstep(0.04 - blur, 0.04 + blur, place);
float dark = clamp(aBand * (1.0 - 0.5 * hZone + 0.45 * mLine) + 0.85 * zDisc, 0.0, 1.0);
dark = mix(uThick / uSarcomere, dark, 1.0 - smoothstep(0.22, 0.5, spread));
vec3 tissue = mix(uIBand, uABand, dark);
tissue = mix(tissue, tissue * 1.22 + vec3(0.05, 0.025, 0.03), vKind * 0.75);
float row = floor((vX - uBack) / uCell.x);
float column = floor(vArc / vColumn);
uint fibre = uint(vFibre + 0.5);
float jitterAlong = cellUnit(fibre, uint(row), uint(column), 1u);
float jitterAround = cellUnit(fibre, uint(row), uint(column), 2u);
float middleAlong = uBack + (row + 0.5 + (jitterAlong - 0.5) * 0.5) * uCell.x;
float middleAround = (column + 0.5 + (jitterAround - 0.5) * 0.6) * vColumn;
vec2 offset = vec2((vX - middleAlong) / uNucleusHalf.x, (vArc - middleAround) / uNucleusHalf.y);
float inside = dot(offset, offset);
float pixel = max(fwidth(vX) / uNucleusHalf.x, fwidth(vArc) / uNucleusHalf.y);
float edge = 2.0 * pixel * sqrt(inside) + 0.04;
float nucleus = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, inside);
vec3 chromatin = mix(uNucleus, tissue, 0.25) * (0.85 + 0.25 * inside);
diffuseColor.rgb = mix(tissue, chromatin, nucleus * 0.6);
`;

const END_VERTEX = /* glsl */ `
attribute float aDepth;
attribute float aKind;
varying float vDepth;
varying float vKind;
varying vec2 vCross;
`;

const END_FRAGMENT = /* glsl */ `
uniform float uLactic;
uniform vec3 uCut;
uniform vec3 uLactate;
varying float vDepth;
varying float vKind;
varying vec2 vCross;
float speck(vec2 cell) {
  return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
}
`;

/**
 * The cut face of a fibre: myofibrils seen end on as a fine stipple in the
 * sarcoplasm, darker toward the sarcolemma, and the lactic acid in it as a
 * rising amber tint, strongest in the fibre's core, farthest from the
 * capillaries that clear it.
 */
const END_COLOUR = /* glsl */ `
vec2 grid = vCross / 0.11;
vec2 cell = floor(grid);
vec2 offset = vec2(speck(cell), speck(cell + 7.3)) * 0.4 - 0.2;
float fibril = 1.0 - smoothstep(0.26, 0.4, length(fract(grid) - 0.5 + offset));
float shown = 1.0 - smoothstep(0.25, 0.6, fwidth(grid.x));
vec3 flesh = uCut * mix(0.96, mix(0.82, 1.06, fibril), shown);
flesh = mix(flesh, flesh * 1.2 + vec3(0.05, 0.02, 0.03), vKind * 0.75);
flesh *= 0.86 + 0.14 * smoothstep(0.0, 0.35, vDepth);
diffuseColor.rgb = mix(flesh, uLactate, uLactic * (0.25 + 0.75 * vDepth) * 0.24);
`;

/** Puts `chunk` after `include` in `source`. */
function after(source: string, include: string, chunk: string) {
  return source.replace(
    `#include <${include}>`,
    `#include <${include}>\n${chunk}`
  );
}

/**
 * The physical materials of the fibres' sides and of their cut ends, with the
 * uniforms the scene moves: the sarcomere length and the lactic acid. `back`
 * is where the fibres start, in scene units, which the nucleus cells count
 * from.
 */
export function useFibreMaterials(back: number) {
  const uniforms = useMemo(
    () => ({
      uABand: { value: new Color(MUSCLE_COLORS.aBand) },
      uBack: { value: back },
      uCell: { value: [CELL.along, CELL.around] },
      uCut: { value: new Color(MUSCLE_COLORS.cut) },
      uIBand: { value: new Color(MUSCLE_COLORS.iBand) },
      uLactate: { value: new Color(MUSCLE_COLORS.lactate) },
      uLactic: { value: 0 },
      uMicrons: { value: MICRONS },
      uNucleus: { value: new Color(MUSCLE_COLORS.nucleus) },
      uNucleusHalf: { value: [NUCLEUS.length / 2, NUCLEUS.width / 2] },
      uRelaxed: { value: RELAXED },
      uSarcomere: { value: RELAXED },
      uThick: { value: THICK },
      uThin: { value: THIN },
    }),
    [back]
  );
  const materials = useMemo(() => {
    // Sheen and its colour are set on the material object, which JSX props cannot name.
    const side = new MeshPhysicalMaterial({
      clearcoat: 0.35,
      clearcoatRoughness: 0.32,
      roughness: 0.46,
      sheen: 0.3,
      sheenColor: new Color(MUSCLE_COLORS.sheath),
      sheenRoughness: 0.6,
    });
    side.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = after(
        after(shader.vertexShader, "common", SIDE_VERTEX),
        "begin_vertex",
        SIDE_PLACE
      );
      shader.fragmentShader = after(
        after(
          after(shader.fragmentShader, "common", SIDE_FRAGMENT),
          "color_fragment",
          SIDE_COLOUR
        ),
        "emissivemap_fragment",
        "totalEmissiveRadiance += diffuseColor.rgb * 0.07;"
      );
    };
    side.customProgramCacheKey = () => "muscle-fibre-side";
    const end = new MeshPhysicalMaterial({
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
      roughness: 0.62,
    });
    end.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = after(
        after(shader.vertexShader, "common", END_VERTEX),
        "begin_vertex",
        "vDepth = aDepth;\nvKind = aKind;\nvCross = position.yz;"
      );
      shader.fragmentShader = after(
        after(
          after(shader.fragmentShader, "common", END_FRAGMENT),
          "color_fragment",
          END_COLOUR
        ),
        "emissivemap_fragment",
        "totalEmissiveRadiance += diffuseColor.rgb * 0.08;"
      );
    };
    end.customProgramCacheKey = () => "muscle-fibre-end";
    return { end, side };
  }, [uniforms]);
  useEffect(
    () => () => {
      materials.side.dispose();
      materials.end.dispose();
    },
    [materials]
  );
  return { materials, uniforms };
}
