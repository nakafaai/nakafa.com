import { createGetArticles } from "@repo/ai/agents/content-access/tools/articles";
import { createGetContent } from "@repo/ai/agents/content-access/tools/content";
import { createGetSubjects } from "@repo/ai/agents/content-access/tools/subjects";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";

interface Params {
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export function contentAccessTools({ writer }: Params) {
  return {
    getContent: createGetContent({ writer }),
    getArticles: createGetArticles({ writer }),
    getSubjects: createGetSubjects({ writer }),
  };
}
