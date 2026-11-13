import { richOptions } from "@repo/design-system/components/editor/extensions";
import { type MathViews, mathExtensions } from "@repo/editor/math";
import type { NodeViewRenderer } from "@tiptap/core";

/**
 * What makes the editor of a written answer, such as an essay: the rich editor's Markdown with its marks, lists and
 * tasks, and the formulas of an exam's documents, which read and write the Markdown the page's reader draws
 * (`@repo/editor/math`), so a saved answer opens with the formulas it was saved with. `formulaViews` draws each
 * formula: the editor gives the design system's views, which open the exam editor's formula editor.
 */
export function answerOptions({
  formulaViews,
  limit,
  onRefuse,
  placeholder,
  taskView,
}: {
  formulaViews: MathViews;
  limit: number;
  onRefuse: () => void;
  placeholder: string;
  taskView: NodeViewRenderer;
}) {
  const rich = richOptions({ limit, onRefuse, placeholder, taskView });
  return {
    ...rich,
    extensions: [...rich.extensions, ...mathExtensions(formulaViews)],
  };
}
