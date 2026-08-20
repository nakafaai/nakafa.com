import {
  matrixSchema,
  nonEmptyStringArraySchema,
} from "@repo/math/schema/shared";
import { Schema, Struct } from "effect";

const MathMatrixUnaryInputSchema = Schema.Struct({
  matrix: matrixSchema,
  operation: Schema.Literals([
    "determinant",
    "eigen_analysis",
    "eigenvalues",
    "eigenvectors",
    "inverse",
    "rank",
    "rref",
  ]).annotate({
    description:
      "Choose the linear algebra operation for one matrix. Use eigen_analysis for eigenspaces, multiplicities, and diagonalizability evidence.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const MathMatrixMultiplyInputSchema = Schema.Struct({
  matrix: matrixSchema,
  operation: Schema.Literal("matrix_multiply").annotate({
    description: "Multiply two matrices.",
  }),
  right_matrix: matrixSchema,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const MathLinearSystemInputSchema = Schema.Struct({
  matrix: matrixSchema,
  operation: Schema.Literal("linear_system").annotate({
    description: "Solve a linear system from coefficient matrix and vector.",
  }),
  vector: nonEmptyStringArraySchema.annotate({
    description: "Right-hand side vector for a linear system.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export const MathMatrixInputSchema = Schema.Union([
  MathMatrixUnaryInputSchema,
  MathMatrixMultiplyInputSchema,
  MathLinearSystemInputSchema,
]).annotate({
  description:
    "Linear algebra tool input. Matrix multiplication requires right_matrix; linear systems require vector.",
});
