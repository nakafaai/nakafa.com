/**
 * How the renderer lays ink on a print's material: three changes to the
 * fragment program of a standard material, each in place of the part that
 * reads a print's coverage.
 *
 * A mipmapped image is soft by about a pixel, since the renderer blends
 * towards the next smaller copy as soon as the image is larger than the
 * screen shows it. A print is drawn at one to two pixels of image for each
 * pixel of screen, so its coverage is read one copy sharper, which is the
 * full image at that size and still a smaller copy from far away. Once a
 * reader zooms in past the largest image the device spares, the blended
 * coverage is a ramp across each edge, and the edge is cut again where the
 * ramp passes its middle, one screen pixel wide, so it stays sharp at any
 * zoom.
 */

/** The uniforms a print adds: the colour of its ground, and how strongly it glows. */
const UNIFORMS = "uniform vec3 printGround;\nuniform float printGlow;\n";

/**
 * Reads the coverage and lays the ink: on a print with a ground the ink is
 * mixed over the ground's colour, and ink alone is as opaque as its
 * coverage. `PRINT_SOFT` marks a print with ink at part strength, whose
 * coverage is never cut.
 */
const COVER = `
#ifdef USE_ALPHAMAP
  float printCover = texture2D( alphaMap, vAlphaMapUv, -1.0 ).g;
  #ifndef PRINT_SOFT
    vec2 printTexel = vAlphaMapUv * vec2( textureSize( alphaMap, 0 ) );
    float printSpread = max( length( dFdx( printTexel ) ), length( dFdy( printTexel ) ) );
    float printEdge = max( fwidth( printCover ), 0.0001 );
    float printCut = clamp( ( printCover - 0.5 ) / printEdge + 0.5, 0.0, 1.0 );
    printCover = mix( printCover, printCut, clamp( 2.0 - 2.0 * printSpread, 0.0, 1.0 ) );
  #endif
  #ifdef PRINT_GROUND
    diffuseColor.rgb = mix( printGround, diffuseColor.rgb, printCover );
  #else
    diffuseColor.a *= printCover;
  #endif
#endif
`;

/** Adds the light a display gives off by itself: its own colours, as bright as it glows. */
const GLOW = `
#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * printGlow;
`;

/** The parts of a standard material's fragment program a print replaces. */
const PARTS = {
  cover: "#include <alphamap_fragment>",
  glow: "#include <emissivemap_fragment>",
  main: "void main() {",
} as const;

/**
 * A standard material's fragment program with ink laid on it. A program
 * that lacks one of the parts a print replaces comes back unchanged, so a
 * renderer that names its parts otherwise draws the print soft instead of
 * failing to draw it.
 */
export function inkProgram(fragment: string): string {
  if (
    !(
      fragment.includes(PARTS.cover) &&
      fragment.includes(PARTS.glow) &&
      fragment.includes(PARTS.main)
    )
  ) {
    return fragment;
  }
  return fragment
    .replace(PARTS.main, `${UNIFORMS}${PARTS.main}`)
    .replace(PARTS.cover, COVER)
    .replace(PARTS.glow, GLOW);
}
