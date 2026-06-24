import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { NinaTurnSchema } from "@repo/ai/nina/contract/turn";
import { PedagogyNarrator } from "@repo/ai/nina/pedagogy/narrator";
import { PedagogyProjectionRepository } from "@repo/ai/nina/pedagogy/repo";
import { NinaReporter } from "@repo/ai/nina/runtime/report";
import { NinaStore } from "@repo/ai/nina/runtime/store";
import { createNinaStreamResponse } from "@repo/ai/nina/runtime/stream";
import { Effect, Schema } from "effect";

/** Raised when a framework boundary sends an invalid Nina harness input. */
export class NinaHarnessInputError extends Schema.TaggedError<NinaHarnessInputError>()(
  "NinaHarnessInputError",
  {
    message: Schema.String,
  }
) {}

/**
 * External Nina harness Interface used by framework routes.
 *
 * Route code supplies request/auth data and app-owned service adapters, while
 * ToolLoopAgent, AI SDK writer callbacks, tool policy, and response composition
 * remain inside this package-owned Module.
 */
export class NinaHarness extends Effect.Service<NinaHarness>()(
  "@repo/ai/NinaHarness",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const store = yield* NinaStore;
      const reporter = yield* NinaReporter;
      const nakafa = yield* Nakafa;
      const search = yield* NakafaSearch;
      const pedagogyNarrator = yield* PedagogyNarrator;
      const pedagogyRepository = yield* PedagogyProjectionRepository;

      return {
        stream: Effect.fn("nina.harness.stream")(function* (input: unknown) {
          const turn = yield* Schema.decodeUnknown(NinaTurnSchema)(input).pipe(
            Effect.mapError(
              () =>
                new NinaHarnessInputError({
                  message: "Invalid Nina harness turn input.",
                })
            )
          );

          return yield* createNinaStreamResponse(turn).pipe(
            Effect.provideService(NinaStore, store),
            Effect.provideService(NinaReporter, reporter),
            Effect.provideService(Nakafa, nakafa),
            Effect.provideService(NakafaSearch, search),
            Effect.provideService(PedagogyNarrator, pedagogyNarrator),
            Effect.provideService(
              PedagogyProjectionRepository,
              pedagogyRepository
            )
          );
        }),
      };
    }),
  }
) {}
