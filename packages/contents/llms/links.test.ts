import { describe, expect, it } from "@effect/vitest";
import { absoluteSiteLinks } from "@repo/contents/llms/links";
import { projectMdxForAgentMarkdown } from "@repo/contents/llms/mdx";
import { Effect } from "effect";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

const PROCESSOR = unified().use(remarkParse).use(remarkMdx);

/** Rewrites one MDX source through its own parsed tree. */
function rewrite(source: string) {
  return absoluteSiteLinks(source, PROCESSOR.parse(source));
}

describe("absolute site links", () => {
  it("writes the site path of a link, an image, and a definition as an absolute URL", () => {
    expect(
      rewrite(`Read the [Privacy Policy](/en/privacy-policy "Policy at /en/privacy-policy").

![Logo](/logo.svg)

See the [terms][terms].

[terms]: /en/terms-of-service
`)
    ).toBe(`Read the [Privacy Policy](https://nakafa.com/en/privacy-policy "Policy at /en/privacy-policy").

![Logo](https://nakafa.com/logo.svg)

See the [terms][terms].

[terms]: https://nakafa.com/en/terms-of-service
`);
  });

  it("gives a link and the image inside its text their own targets", () => {
    expect(rewrite("[![Badge](/badge.svg)](/badge.svg)")).toBe(
      "[![Badge](https://nakafa.com/badge.svg)](https://nakafa.com/badge.svg)"
    );
  });

  it("leaves every target that is not a site path", () => {
    const source = `[Site](https://nakafa.com/en) [Other host](//example.com/a) [Section](#rules) [Sibling](other.md)

\`[code](/en/code)\`

<a href="/en/jsx">JSX</a>
`;
    expect(rewrite(source)).toBe(source);
  });

  it("leaves a target that the source writes with an escape", () => {
    const source = "[Escaped](/en/a\\_b)";
    expect(rewrite(source)).toBe(source);
  });

  it("leaves a node that carries no position", () => {
    expect(
      absoluteSiteLinks("[Home](/en)", {
        type: "root",
        children: [{ type: "link", url: "/en", children: [] }],
      })
    ).toBe("[Home](/en)");
  });

  it.effect("reaches the agent Markdown of a page", () =>
    Effect.gen(function* () {
      expect(
        yield* projectMdxForAgentMarkdown(
          "## Related\n\n- [Security Policy](/en/security-policy)\n- [Terms](/en/terms-of-service)"
        )
      ).toBe(
        "## Related\n\n- [Security Policy](https://nakafa.com/en/security-policy)\n- [Terms](https://nakafa.com/en/terms-of-service)"
      );
    })
  );
});
