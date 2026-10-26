import type { SlashLabels } from "@repo/design-system/components/editor/slash";
import { useMemo } from "react";
import { useTranslations } from "use-intl";

/**
 * The names of an exam prompt's toolbar, slash menu, and formula editor, read from the editor's
 * messages. The toolbar and the slash menu name a block with the same words, so each name is
 * read once.
 */
export function useDocumentLabels() {
  const t = useTranslations("Editor");
  return useMemo(() => {
    const bullets = t("bullets");
    const codeBlock = t("code-block");
    const equation = t("equation");
    const formula = t("formula");
    const heading1 = t("heading-1");
    const heading2 = t("heading-2");
    const heading3 = t("heading-3");
    const insert = t("insert");
    const numbers = t("numbers");
    const quote = t("quote");
    const table = t("table");
    const text = t("text");
    const slash: SlashLabels = {
      bullets,
      "code-block": codeBlock,
      equation,
      formula,
      "heading-1": heading1,
      "heading-2": heading2,
      "heading-3": heading3,
      numbers,
      quote,
      table,
      text,
    };
    return {
      pictures: {
        add: t("image-add"),
        alt: t("image-alt"),
        altHint: t("image-alt-hint"),
        cancel: t("image-cancel"),
        delete: t("image-delete"),
        edit: t("image-edit"),
        save: t("image-save"),
      },
      formulaEdit: {
        formula,
        invalid: t("formula-invalid"),
        latex: t("latex"),
        open: t("formula-edit"),
      },
      insert,
      slash,
      toolbar: {
        arabic: t("arabic"),
        bold: t("bold"),
        bullets,
        code: t("code"),
        codeBlock,
        columnAfter: t("column-after"),
        columnBefore: t("column-before"),
        columnDelete: t("column-delete"),
        equation,
        formula,
        heading1,
        heading2,
        heading3,
        image: t("image"),
        insert,
        italic: t("italic"),
        link: t("link"),
        linkPlaceholder: t("link-placeholder"),
        lists: t("lists"),
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
