/**
 * The names of a scene's axes as KaTeX draws them, written out once, so a scene
 * that names its axes loads no math runtime. `names.test.ts` draws each name with
 * KaTeX and checks that its markup is still this.
 */
export const AXIS_NAMES = {
  X: '<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>X</mi></mrow><annotation encoding="application/x-tex">X</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="katex-base"><span class="katex-strut" style="height:0.6833em;"></span><span class="mord mathnormal" style="margin-right:0.0785em;">X</span></span></span></span>',
  Y: '<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>Y</mi></mrow><annotation encoding="application/x-tex">Y</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="katex-base"><span class="katex-strut" style="height:0.6833em;"></span><span class="mord mathnormal" style="margin-right:0.2222em;">Y</span></span></span></span>',
  Z: '<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>Z</mi></mrow><annotation encoding="application/x-tex">Z</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="katex-base"><span class="katex-strut" style="height:0.6833em;"></span><span class="mord mathnormal" style="margin-right:0.0715em;">Z</span></span></span></span>',
} as const;

/** One axis of a scene, by the name it shows. */
export type AxisName = keyof typeof AXIS_NAMES;
