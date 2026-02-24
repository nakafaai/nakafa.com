import { createScrape } from "@repo/ai/agents/research/tools/scrape";
import { createWebSearch } from "@repo/ai/agents/research/tools/web-search";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";

interface Params {
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export function researchTools({ writer }: Params) {
  return {
    webSearch: createWebSearch({ writer }),
    scrape: createScrape({ writer }),
  };
}
