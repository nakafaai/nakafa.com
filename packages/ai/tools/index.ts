import { createGetArticles } from "@repo/ai/tools/articles";
import { createCalculator } from "@repo/ai/tools/calculator";
import { createGetContent } from "@repo/ai/tools/content";
import { createScrape } from "@repo/ai/tools/scrape";
import { createGetSubjects } from "@repo/ai/tools/subjects";
import { createWebSearch } from "@repo/ai/tools/web-search";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";

interface Params {
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export function tools({ writer }: Params) {
  return {
    getContent: createGetContent({ writer }),
    getArticles: createGetArticles({ writer }),
    getSubjects: createGetSubjects({ writer }),
    calculator: createCalculator({ writer }),
    scrape: createScrape({ writer }),
    webSearch: createWebSearch({ writer }),
  };
}
