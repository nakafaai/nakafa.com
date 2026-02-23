import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { createScrape } from "./tools/scrape";
import { createWebSearch } from "./tools/web-search";

interface Params {
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export function researchTools({ writer }: Params) {
  return {
    webSearch: createWebSearch({ writer }),
    scrape: createScrape({ writer }),
  };
}
