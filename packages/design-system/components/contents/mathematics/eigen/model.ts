import { Match, Schema } from "effect";

const EigenTransformSchema = Schema.Literals([
  "stretchShear",
  "symmetricDiag",
  "reflectionScale",
  "anisotropic3D",
]);

export type EigenTransform = typeof EigenTransformSchema.Type;

const EigenSummarySchema = Schema.Struct({
  determinant: Schema.Finite,
  eigenvalues: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  scaleX: Schema.Finite,
  scaleY: Schema.Finite,
  scaleZ: Schema.Finite,
  shearXY: Schema.Finite,
});

/** Compute interpolated 3D linear transformation scaling, shear, eigenvalues, and determinant. */
export function evaluateEigenTransform(
  transform: EigenTransform,
  progress: number
): typeof EigenSummarySchema.Type {
  const t = Math.min(1, Math.max(0, progress));
  const lerp = (target: number) => 1 + (target - 1) * t;

  const eigenvalues: (typeof EigenSummarySchema.Type)["eigenvalues"] =
    Match.value(transform).pipe(
      Match.when("stretchShear", () => [1.8, 1.0, 1.0] as const),
      Match.when("symmetricDiag", () => [1.7, 1.25, 0.7] as const),
      Match.when("reflectionScale", () => [-1.2, 1.4, 1.0] as const),
      Match.when("anisotropic3D", () => [1.9, 0.6, 1.3] as const),
      Match.exhaustive
    );
  const shearTarget = Match.value(transform).pipe(
    Match.when("stretchShear", () => 0.55),
    Match.when("symmetricDiag", () => 0),
    Match.when("reflectionScale", () => 0),
    Match.when("anisotropic3D", () => 0.25),
    Match.exhaustive
  );
  const scaleX = lerp(eigenvalues[0]);
  const scaleY = lerp(eigenvalues[1]);
  const scaleZ = lerp(eigenvalues[2]);

  return {
    determinant: Number((scaleX * scaleY * scaleZ).toFixed(2)),
    eigenvalues,
    scaleX,
    scaleY,
    scaleZ,
    shearXY: shearTarget * t,
  };
}
