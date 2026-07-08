import { preserveShikiLineBreaks } from "@repo/design-system/lib/shiki";
import { describe, expect, it } from "vitest";

describe("preserveShikiLineBreaks", () => {
  it("adds text newlines between rendered Shiki line spans", () => {
    const html =
      '<pre><code><span class="line">one</span><span class="line">two</span></code></pre>';

    expect(preserveShikiLineBreaks(html)).toBe(
      '<pre><code><span class="line">one</span>\n<span class="line">two</span></code></pre>'
    );
  });
});
