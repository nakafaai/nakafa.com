import type { UIMessageStreamWriter } from "ai";
import type { MyUIMessage } from "../types/message";
import { createGetArticles } from "./articles";
import { createCalculator } from "./calculator";
import { createGetContent } from "./content";
import { createScrape, createWebSearch } from "./firecrawl";
import { createGetSubjects } from "./subjects";

type Params = {
  writer: UIMessageStreamWriter<MyUIMessage>;
};

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
