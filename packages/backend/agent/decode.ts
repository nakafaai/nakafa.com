import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { Effect, Schema } from "effect";

export type AgentSchema = Schema.ConstraintDecoder<unknown, never>;

const parseOptions = { onExcessProperty: "error" } as const;

/** Decodes untrusted public input through an Effect schema. */
export function decodeAgentInput<SchemaType extends AgentSchema>(
  schema: SchemaType,
  input: unknown,
  message: string
) {
  return Schema.decodeUnknownEffect(
    schema,
    parseOptions
  )(input).pipe(
    Effect.mapError(
      (error) =>
        new NakafaAgentInputError({
          cause: getUnknownErrorMessage(error),
          message,
        })
    )
  );
}

/** Validates one generated public payload before returning it to an agent. */
export function decodeAgentOutput<SchemaType extends AgentSchema>(
  schema: SchemaType,
  output: unknown,
  message: string
) {
  return Schema.decodeUnknownEffect(
    schema,
    parseOptions
  )(output).pipe(
    Effect.mapError(
      (error) =>
        new NakafaAgentDataReadError({
          cause: getUnknownErrorMessage(error),
          message,
        })
    )
  );
}
