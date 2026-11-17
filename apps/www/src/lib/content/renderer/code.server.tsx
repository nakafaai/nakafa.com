import { CodeBlockMdx } from "@repo/design-system/components/markdown/code/client";
import type { CodeBlockData } from "@repo/design-system/lib/code/context";
import { highlightLessonCode } from "@repo/design-system/lib/code/lesson";
import { Effect } from "effect";

/**
 * A lesson's code block. Its colours are drawn here, when the lesson is built, so
 * the first paint already has them and the browser loads no highlighter. The
 * server registers only the grammars lessons write in (`lesson.ts`), so a block
 * in any other language fails the build, which names it, instead of shipping
 * as plain text.
 */
export async function CodeBlockServer({ data }: { data: CodeBlockData[] }) {
  const highlighted = await Effect.runPromise(
    Effect.forEach(data, (item) =>
      Effect.map(
        highlightLessonCode({ code: item.code, language: item.language }),
        (html) => ({ ...item, html })
      )
    )
  );
  return <CodeBlockMdx data={highlighted} />;
}
