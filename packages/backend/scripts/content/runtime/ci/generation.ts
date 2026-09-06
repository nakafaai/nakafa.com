import {
  buildRuntimeGenerations,
  type RuntimeGenerations,
} from "@repo/backend/content/snapshot/selection";
import { readProductionTable } from "@repo/backend/scripts/content/runtime/ci/command";
import type { ProductionConfig } from "@repo/backend/scripts/content/runtime/ci/config";
import { Effect, Redacted } from "effect";
/** Reads the exact current signed pointer from production. */
export const readProductionGenerations = Effect.fn(
  "contentRuntime.readProductionGenerations"
)(function* (config: Pick<ProductionConfig, "deployKey">) {
  const deployKey = Redacted.value(config.deployKey);
  const contentState = yield* readProductionTable({
    deployKey,
    limit: 2,
    table: "contentState",
  });
  return yield* buildRuntimeGenerations(contentState);
});
export const formatGenerationEnvironment = (generations: RuntimeGenerations) =>
  `CONTENT_RUNTIME_SELECTION_HASH=${generations.runtimeSelectionHash}`;
