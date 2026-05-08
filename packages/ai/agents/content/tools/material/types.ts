import type { GetContentInput } from "@repo/ai/agents/content/schema";
import type { AgentContext } from "@repo/ai/types/agents";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import type { UIMessageStreamWriter } from "ai";

export interface FetchParams {
  context: AgentContext;
  input: GetContentInput;
  locale: Locale;
  toolCallId: string;
  usePageInput: boolean;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export interface RouteParams {
  cleanedSlug: string;
  contentInput: GetContentInput;
  toolCallId: string;
  url: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}
