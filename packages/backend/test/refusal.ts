import { RegisteredFunction } from "@confect/server";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { runStep } from "@repo/backend/confect/contents/sections/build";
import type { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { GatewayTest } from "@repo/backend/test/gateway";
import {
  Array as Arr,
  Effect,
  Layer,
  Logger,
  MutableRef,
  Schema,
} from "effect";

/** One log line that a test reads back, as the logger formats it. */
const loggedLineValidator = Schema.Struct({
  annotations: Schema.Record(Schema.String, Schema.Unknown),
  level: Schema.String,
  message: Schema.Unknown,
});

/**
 * Runs one step that is expected to fail, and gives its failure with the log
 * lines that the step wrote, in order, each with its level, message, and
 * annotations.
 */
export async function failedStepLogs(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  input: Parameters<typeof runStep>[0] = {}
) {
  const logged = MutableRef.make<readonly (typeof loggedLineValidator.Type)[]>(
    []
  );
  const failure = await t.action((ctx) =>
    Effect.runPromise(
      Effect.flip(runStep(input)).pipe(
        Effect.map(({ _tag, message }) => ({ _tag, message })),
        Effect.provide(
          Layer.mergeAll(
            GatewayTest,
            RegisteredFunction.actionLayer(confectSchema, ctx),
            Logger.layer([
              Logger.formatStructured.pipe(
                Logger.map(({ annotations, level, message }) =>
                  MutableRef.update(
                    logged,
                    Arr.append({ annotations, level, message })
                  )
                )
              ),
            ])
          )
        )
      )
    )
  );
  return { failure, logs: MutableRef.get(logged) };
}
