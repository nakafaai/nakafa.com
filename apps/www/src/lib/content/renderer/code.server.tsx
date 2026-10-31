import { CodeBlockMdx } from "@repo/design-system/components/markdown/code/client";
import type { CodeBlockData } from "@repo/design-system/lib/code-block/context";
import { highlightCode } from "@repo/design-system/lib/code-block/highlight";
import { Effect, Option } from "effect";

/**
 * A lesson's code block. Its colours are drawn here, when the lesson is built, so
 * the first paint already has them and the browser loads no highlighter. A source
 * that cannot be highlighted stays plain text, and the block's own highlighter
 * tries it once more in the browser.
 */
export async function CodeBlockServer({ data }: { data: CodeBlockData[] }) {
  const highlighted = await Effect.runPromise(
    Effect.forEach(data, (item) =>
      highlightCode({ code: item.code, language: item.language }).pipe(
        Effect.option,
        Effect.map((html) =>
          Option.match(html, {
            onNone: () => item,
            onSome: (value) => ({ ...item, html: value }),
          })
        )
      )
    )
  );
  return <CodeBlockMdx data={highlighted} />;
}
