import {
  matrixSchema,
  nonEmptyStringArraySchema,
} from "@repo/math/schema/shared";
import { Schema } from "effect";

const MathMatrixUnaryInputSchema = Schema.Struct({
  matrix: matrixSchema,
  operation: Schema.Literal(
    "determinant",
    "eigen_analysis",
    "eigenvalues",
    "eigenvectors",
    "inverse",
    "rank",
    "rref"
  ).annotations({
    description:
      "Choose the linear algebra operation for one matrix. Use eigen_analysis for eigenspaces, multiplicities, and diagonalizability evidence.",
  }),
}).pipe(Schema.mutable);

const MathMatrixMultiplyInputSchema = Schema.Struct({
  matrix: matrixSchema,
  operation: Schema.Literal("matrix_multiply").annotations({
    description: "Multiply two matrices.",
  }),
  right_matrix: matrixSchema,
}).pipe(Schema.mutable);

const MathLinearSystemInputSchema = Schema.Struct({
  matrix: matrixSchema,
  operation: Schema.Literal("linear_system").annotations({
    description: "Solve a linear system from coefficient matrix and vector.",
  }),
  vector: nonEmptyStringArraySchema.annotations({
    description: "Right-hand side vector for a linear system.",
  }),
}).pipe(Schema.mutable);

export const MathMatrixInputSchema = Schema.Union(
  MathMatrixUnaryInputSchema,
  MathMatrixMultiplyInputSchema,
  MathLinearSystemInputSchema
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Linear algebra tool input. Matrix multiplication requires right_matrix; linear systems require vector.",
  });
