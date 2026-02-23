import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { createGetArticles } from "./tools/articles";
import { createGetContent } from "./tools/content";
import { createGetSubjects } from "./tools/subjects";

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
