/**
 * How the renderer shows the thickness of clear glass: one change to the
 * fragment program of a physical material. A sheet of glass seen square on
 * is nearly invisible, but where its wall turns away from the eye the light
 * crosses far more glass, so the outline of a beaker is its darkest, most
 * solid part and carries the faint green of the glass itself. The program
 * raises the glass's opacity toward `EDGE` and leans its colour toward the
 * edge tint as the surface turns away from the viewer.
 */

/** The uniform the edge adds: the colour of the glass seen through its wall. */
const UNIFORMS = "uniform vec3 edgeTint;\n";

/** How opaque glass is where its wall is seen edge on, and how sharply that falls off toward its face. */
const EDGE = { opacity: "0.4", power: "3.6" } as const;

/** Thickens the glass toward its outline, after the material's own colour is read. */
const THICKEN = `
#include <color_fragment>
float edgeTurn = pow( 1.0 - abs( dot( normalize( vNormal ), normalize( vViewPosition ) ) ), ${EDGE.power} );
diffuseColor.rgb = mix( diffuseColor.rgb, edgeTint, edgeTurn * 0.6 );
diffuseColor.a = mix( diffuseColor.a, ${EDGE.opacity}, edgeTurn );
`;

/** The parts of a physical material's fragment program the edge replaces. */
const PARTS = {
  colour: "#include <color_fragment>",
  main: "void main() {",
} as const;

/**
 * A physical material's fragment program with the edge of glass added. A
 * program that lacks one of the parts the edge replaces comes back
 * unchanged, so a renderer that names its parts otherwise draws thin glass
 * instead of failing to draw it.
 */
export function edgeProgram(fragment: string): string {
  if (!(fragment.includes(PARTS.colour) && fragment.includes(PARTS.main))) {
    return fragment;
  }
  return fragment
    .replace(PARTS.main, `${UNIFORMS}${PARTS.main}`)
    .replace(PARTS.colour, THICKEN);
}
