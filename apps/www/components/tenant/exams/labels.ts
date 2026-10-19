import type { SlashLabels } from "@repo/design-system/components/editor/slash";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

/**
 * The names of an exam prompt's toolbar and slash menu, read from the editor's messages. The
 * toolbar and the slash menu name a block with the same words, so each name is read once.
 */
export function useDocumentLabels() {
  const t = useTranslations("Editor");
  return useMemo(() => {
    const bullets = t("bullets");
    const codeBlock = t("code-block");
    const heading1 = t("heading-1");
    const heading2 = t("heading-2");
    const heading3 = t("heading-3");
    const numbers = t("numbers");
    const quote = t("quote");
    const table = t("table");
    const text = t("text");
    const slash: SlashLabels = {
      bullets,
      "code-block": codeBlock,
      "heading-1": heading1,
      "heading-2": heading2,
      "heading-3": heading3,
      numbers,
      quote,
      table,
      text,
    };
    return {
      insert: t("insert"),
      slash,
      toolbar: {
        bold: t("bold"),
        bullets,
        code: t("code"),
        codeBlock,
        columnAfter: t("column-after"),
        columnBefore: t("column-before"),
        columnDelete: t("column-delete"),
        heading1,
        heading2,
        heading3,
        italic: t("italic"),
        link: t("link"),
        linkPlaceholder: t("link-placeholder"),
        more: t("more"),
        numbers,
        quote,
        redo: t("redo"),
        rowAfter: t("row-after"),
        rowBefore: t("row-before"),
        rowDelete: t("row-delete"),
        style: t("style"),
        subscript: t("subscript"),
        superscript: t("superscript"),
        table,
        tableActions: t("table-actions"),
        tableDelete: t("table-delete"),
        text,
        underline: t("underline"),
        undo: t("undo"),
      },
    };
  }, [t]);
}
