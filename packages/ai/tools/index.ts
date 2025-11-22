import { createGetArticles } from "@repo/ai/tools/articles";
import { createCalculator } from "@repo/ai/tools/calculator";
import { createGetContent } from "@repo/ai/tools/content";
import { createCreateDataset } from "@repo/ai/tools/dataset";
import { createScrape } from "@repo/ai/tools/scrape";
import { createGetSubjects } from "@repo/ai/tools/subjects";
import { createWebSearch } from "@repo/ai/tools/web-search";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { UIMessageStreamWriter } from "ai";

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

export function financeTools({
  writer,
  chatId,
  token,
}: Params & { chatId: Id<"chats">; token: string }) {
  return {
    createDataset: createCreateDataset({ writer, chatId, token }),
  };
}
