import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";

type WrittenPart = Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0];

/** Creates a minimal writer for Nakafa tool data-part tests. */
export function createWriter() {
  const parts: WrittenPart[] = [];
  const writer = {
    write: (part) => {
      parts.push(part);
    },
  } satisfies Pick<UIMessageStreamWriter<MyUIMessage>, "write">;

  return { parts, writer };
}
