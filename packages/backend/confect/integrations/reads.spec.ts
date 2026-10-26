import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  ApiCohort,
  ApiPeriod,
  ApiPerson,
  ApiPlacement,
} from "@repo/backend/confect/integrations/api";
import { PersonStatus } from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/** The refusal of a read that the client's action list or scope does not open. */
export const Forbidden = Schema.Struct({
  outcome: Schema.Literal("forbidden"),
});

/** One page of a client's read, or the refusal of a read its action list or scope does not open. */
const answerOf = <S extends Schema.Top>(item: S) =>
  Schema.Union([
    Schema.Struct({
      data: Schema.Array(item),
      next: Schema.NullOr(Schema.String),
      outcome: Schema.Literal("page"),
    }),
    Forbidden,
  ]);

/** The page of a read that names a cursor and a size. */
const page = { cursor: Schema.NullOr(Schema.String), numItems: Schema.Finite };

/**
 * The roster reads of the school API (ADR 0029, amendment rule 6). Each takes the client
 * that the bearer check verified, never a school the caller names, and decides every row
 * for that client. They are internal: only the HTTP routes call them.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "periods",
      args: () => ({ clientId: Id("integrationClients") }),
      returns: () => answerOf(ApiPeriod),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "cohorts",
      args: () => ({
        ...page,
        clientId: Id("integrationClients"),
        period: Schema.String,
      }),
      returns: () => answerOf(ApiCohort),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "people",
      args: () => ({
        ...page,
        clientId: Id("integrationClients"),
        status: PersonStatus,
      }),
      returns: () => answerOf(ApiPerson),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "placements",
      args: () => ({
        ...page,
        clientId: Id("integrationClients"),
        period: Schema.String,
      }),
      returns: () => answerOf(ApiPlacement),
    })
  );
