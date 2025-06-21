import type { CodeProps } from "@repo/design-system/types/markdown";
import { codeToHtml, createCssVariablesTheme } from "shiki";

const CONSTANTS = {
  CODE_REGEX: /language-/,
};

const cssVariablesTheme = createCssVariablesTheme({});

export async function Code(props: CodeProps) {
  if (typeof props.children === "string") {
    const lang = props.className?.replace(CONSTANTS.CODE_REGEX, "") || "jsx";

    const code = await codeToHtml(props.children, {
      lang,
      theme: cssVariablesTheme,
      transformers: [
        {
          // Since we're using dangerouslySetInnerHTML, the code and pre
          // tags should be removed.
          pre: (hast) => {
            if (hast.children.length !== 1) {
              throw new Error("<pre>: Expected a single <code> child");
            }
            if (hast.children[0].type !== "element") {
              throw new Error("<pre>: Expected a <code> child");
            }
            return hast.children[0];
          },
          postprocess(html) {
            return html.replace(/^<code>|<\/code>$/g, "");
          },
        },
      ],
    });

    return (
      <code
        className="inline text-xs sm:text-sm"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: We're using shiki to render the code
        dangerouslySetInnerHTML={{ __html: code }}
      />
    );
  }

  return <code className="inline" {...props} />;
}
