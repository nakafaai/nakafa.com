import { describe, expect, it } from "@effect/vitest";
import type { AssessmentDocument as Document } from "@nakafa/aksara-contracts/assessment/document";
import { AssessmentDocumentSchema } from "@nakafa/aksara-contracts/assessment/document";
import {
  BlockMath,
  MathContainer,
} from "@repo/design-system/components/markdown/math";
import {
  ContentBlock,
  ContentGrid,
  ContentStack,
} from "@repo/design-system/components/markdown/mdx";
import { VisualCard } from "@repo/design-system/components/visual/card";
import {
  blockGapVariants,
  contentGridVariants,
  contentStackVariants,
  mathContainerVariants,
} from "@repo/design-system/lib/prose";
import { Schema } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssessmentDocument } from "@/components/assessment/document";

const decodeDoc = (content: readonly unknown[]): Document =>
  Schema.decodeSync(AssessmentDocumentSchema)({ content, type: "doc" });

const parseHtml = (html: string) => {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
};

describe("AssessmentDocument and unified prose spacing", () => {
  it("fuses BlockMath rows inside MathContainer without internal my-4 spacing and spaces BlockMath/MathContainer beside VisualCard", () => {
    const stacked = parseHtml(
      renderToStaticMarkup(
        createElement(
          "div",
          null,
          createElement(
            MathContainer,
            null,
            createElement(BlockMath, { math: "v = s/t" }),
            createElement(BlockMath, { math: "a = v/t" })
          ),
          createElement(VisualCard, null, createElement("div", null, "scene"))
        )
      )
    );
    const container = stacked.querySelector('[data-slot="math-container"]');
    expect(container?.className).toBe(mathContainerVariants());
    expect(stacked.querySelectorAll("[data-math-block]")).toHaveLength(2);
    expect(stacked.querySelector('[data-slot="visual-card"]')?.className).toBe(
      blockGapVariants()
    );

    const standalone = parseHtml(
      renderToStaticMarkup(
        createElement(
          "div",
          null,
          createElement(BlockMath, { math: "F = ma" }),
          createElement(VisualCard, null, createElement("div", null, "scene"))
        )
      )
    );
    expect(standalone.querySelector("[data-math-block]")?.className).toContain(
      blockGapVariants()
    );
    expect(
      standalone.querySelector('[data-slot="visual-card"]')?.className
    ).toBe(blockGapVariants());
  });

  it("zeroes child vertical margins inside ContentStack, ContentGrid, and keeps blockGapVariants on ContentBlock", () => {
    const blockEl = parseHtml(
      renderToStaticMarkup(
        createElement(ContentBlock, null, createElement("p", null, "one"))
      )
    ).firstElementChild;
    const stackEl = parseHtml(
      renderToStaticMarkup(
        createElement(ContentStack, null, createElement("p", null, "two"))
      )
    ).firstElementChild;
    const gridEl = parseHtml(
      renderToStaticMarkup(
        createElement(ContentGrid, null, createElement("p", null, "three"))
      )
    ).firstElementChild;

    expect(blockEl?.className).toBe(blockGapVariants());
    expect(stackEl?.className).toBe(contentStackVariants());
    expect(gridEl?.className).toBe(contentGridVariants());
  });

  it("renders mathContainer, contentGrid, figure spacing, and defensively groups legacy consecutive mathBlocks", () => {
    const docNode = decodeDoc([
      {
        content: [
          { attrs: { latex: "x + 1 = 2" }, type: "mathBlock" },
          { attrs: { latex: "x = 1" }, type: "mathBlock" },
        ],
        type: "mathContainer",
      },
      {
        content: [
          {
            content: [{ text: "Grid item", type: "text" }],
            type: "paragraph",
          },
        ],
        type: "contentGrid",
      },
      { attrs: { latex: "a = 3" }, type: "mathBlock" },
      { attrs: { latex: "b = 4" }, type: "mathBlock" },
      {
        attrs: {
          alt: "Diagram alir",
          caption: null,
          component: "Mermaid",
          props: {
            chart: "graph TD; A-->B",
            description: [{ text: "Dua langkah", type: "text" }],
            title: [{ text: "Alur", type: "text" }],
          },
        },
        type: "figure",
      },
    ]);

    const root = parseHtml(
      renderToStaticMarkup(
        createElement(AssessmentDocument, {
          document: docNode,
          label: "Pembahasan",
        })
      )
    );

    const containers = root.querySelectorAll('[data-slot="math-container"]');
    expect(containers).toHaveLength(2);
    expect(containers[0]?.className).toBe(mathContainerVariants());
    expect(containers[1]?.className).toBe(mathContainerVariants());

    const figure = root.querySelector("figure");
    expect(figure?.className).toContain(blockGapVariants());
    expect(figure?.className).toContain("*:data-[slot=visual-card]:my-0");
    expect(root.innerHTML).toContain(contentGridVariants());
  });
});
