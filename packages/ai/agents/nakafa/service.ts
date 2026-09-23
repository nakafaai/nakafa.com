import type { ActiveAppLocaleCode as Locale } from "@nakafa/aksara-contracts/locale";
import type {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/agent/errors";
import type { NakafaAgentQuranReference } from "@repo/contents/agent/schema/quran/reference";
import type { NakafaAgentMarkdown } from "@repo/contents/agent/schema/read";
import type { NakafaAgentTaxonomy } from "@repo/contents/agent/schema/taxonomy";
import { Context, type Effect, type Option } from "effect";

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
/** Runtime-injected Nakafa content read model service. */
export class Nakafa extends Context.Service<Nakafa, NakafaRuntime>()(
  "@repo/ai/Nakafa"
) {}
