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
  const tCommon = useTranslations("Common");
  return useMemo(() => {
    const bullets = t("bullets");
    const codeBlock = t("code-block");
    const equation = tCommon("equation");
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
        addDescription: t("image-add-description"),
        alt: t("image-alt"),
        altHint: t("image-alt-hint"),
        cancel: tCommon("cancel"),
        delete: t("image-delete"),
        edit: t("image-edit"),
        editDescription: t("image-edit-description"),
        save: tCommon("save"),
      },
      formulaEdit: {
        formula,
        invalid: t("formula-invalid"),
        keyboard: t("formula-keyboard"),
        keys: {
          chemistry: t("formula-key.chemistry"),
          delete: t("formula-key.delete"),
          functions: t("formula-key.functions"),
          greek: t("formula-key.greek"),
          left: t("formula-key.left"),
          numbers: t("formula-key.numbers"),
          physics: t("formula-key.physics"),
          right: t("formula-key.right"),
          symbols: t("formula-key.symbols"),
        },
        latex: t("latex"),
        open: t("formula-edit"),
        remove: t("formula-remove"),
      },
      insert,
      slash,
      toolbar: {
        arabic: t("arabic"),
        bold: t("bold"),
        bullets,
        code: tCommon("code"),
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
        italic: t("italic"),
        link: tCommon("link"),
        linkInvalid: t("link-invalid"),
        linkPlaceholder: t("link-placeholder"),
        more: tCommon("more"),
        numbers,
        quote,
        redo: tCommon("redo"),
        rowAfter: t("row-after"),
        rowBefore: t("row-before"),
        rowDelete: t("row-delete"),
        style: t("style"),
        styleMenu: t("menu-style"),
        subscript: t("subscript"),
        superscript: t("superscript"),
        table,
        tableDelete: t("table-delete"),
        text,
        underline: t("underline"),
        undo: tCommon("undo"),
      },
    };
  }, [t, tCommon]);
}
