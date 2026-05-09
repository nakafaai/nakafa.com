import type { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import type {
  NakafaAgentSearchInput,
  NakafaAgentSearchResult,
} from "@repo/contents/_lib/agent/schema/search";
import { Context, type Effect } from "effect";

/**
 * Runtime-injected infrastructure adapter for Convex-backed Nakafa search.
 *
 * Context.Tag is intentional here because each app provides its own Convex
 * boundary instead of `@repo/ai` owning deployment configuration.
 */
export class NakafaSearch extends Context.Tag("NakafaSearch")<
  NakafaSearch,
  {
    readonly search: (
      input: NakafaAgentSearchInput
    ) => Effect.Effect<NakafaAgentSearchResult, NakafaAgentDataReadError>;
  }
>() {}
