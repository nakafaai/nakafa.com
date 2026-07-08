import type {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import type { NakafaAgentQuranReference } from "@repo/contents/_lib/agent/schema/quran";
import type { NakafaAgentMarkdown } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentTaxonomy } from "@repo/contents/_lib/agent/schema/taxonomy";
import type { Locale } from "@repo/utilities/locales";
import { Effect, type Option } from "effect";

type NakafaReadError = NakafaAgentDataReadError | NakafaAgentInputError;

/** Runtime-injected Nakafa content read model used by AI, chat, and MCP. */
export interface NakafaRuntime {
  quran: (
    input: unknown
  ) => Effect.Effect<Option.Option<NakafaAgentQuranReference>, NakafaReadError>;
  read: (
    input: string
  ) => Effect.Effect<Option.Option<NakafaAgentMarkdown>, NakafaReadError>;
  taxonomy: (
    locale?: Locale
  ) => Effect.Effect<NakafaAgentTaxonomy, NakafaReadError>;
  verify: (input: string) => Effect.Effect<boolean, NakafaReadError>;
}

const missingNakafaRuntime: NakafaRuntime = {
  /** Fails fast when no app-owned Nakafa runtime adapter was provided. */
  quran: (_input) =>
    Effect.dieMessage("Nakafa runtime service was not provided."),
  /** Fails fast when no app-owned Nakafa runtime adapter was provided. */
  read: (_input) =>
    Effect.dieMessage("Nakafa runtime service was not provided."),
  /** Fails fast when no app-owned Nakafa runtime adapter was provided. */
  taxonomy: (_locale) =>
    Effect.dieMessage("Nakafa runtime service was not provided."),
  /** Fails fast when no app-owned Nakafa runtime adapter was provided. */
  verify: (_input) =>
    Effect.dieMessage("Nakafa runtime service was not provided."),
};

/** Runtime-injected Nakafa content read model service. */
export class Nakafa extends Effect.Service<Nakafa>()("@repo/ai/Nakafa", {
  accessors: true,
  succeed: missingNakafaRuntime,
}) {}
