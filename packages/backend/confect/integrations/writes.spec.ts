import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { IdempotencyKey } from "@repo/backend/confect/integrations/schema";
import { GradeValue } from "@repo/backend/confect/records/scheme";
import {
  IMPORT_BATCH,
  ImportRow,
  ImportSummary,
} from "@repo/backend/confect/roster/schema";
import { Schema } from "effect";

/** What a write answers: its result, a refusal of what the client may not do, or a repeat of its key with another request. */
const WriteAnswer = Schema.Union([
  Schema.Struct({ outcome: Schema.Literal("applied"), summary: ImportSummary }),
  Schema.Struct({ outcome: Schema.Literal("forbidden") }),
  Schema.Struct({ outcome: Schema.Literal("conflict") }),
]);

/** What a grade entry answers: its draft, a refusal of what the client may not do, or what the grade's state refuses. */
const GradeAnswer = Schema.Union([
  Schema.Struct({
    grade: Schema.Struct({ id: Schema.String, value: GradeValue }),
    outcome: Schema.Literal("entered"),
  }),
  Schema.Struct({ outcome: Schema.Literal("forbidden") }),
  Schema.Struct({ outcome: Schema.Literal("notPlaced") }),
  Schema.Struct({ outcome: Schema.Literal("released") }),
]);

/**
 * The writes of the school API (ADR 0029). Each takes the client the bearer check verified, and
 * decides again in its own transaction, so a client revoked between two calls stops at the
 * write. The change, its journal entry, and its idempotency record commit together.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "importRoster",
      args: () => ({
        clientId: Id("integrationClients"),
        digest: Schema.String,
        key: IdempotencyKey,
        period: Schema.String,
        rows: Schema.Array(ImportRow).check(Schema.isMaxLength(IMPORT_BATCH)),
      }),
      returns: () => WriteAnswer,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "enterGrade",
      args: () => ({
        classId: Schema.String,
        clientId: Id("integrationClients"),
        personId: Schema.String,
        value: GradeValue,
      }),
      returns: () => GradeAnswer,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweep",
      args: () => ({}),
      returns: () => Schema.Null,
    })
  );
