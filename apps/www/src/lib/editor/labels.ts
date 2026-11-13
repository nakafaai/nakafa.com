import type { SlashLabels } from "@repo/design-system/components/editor/slash";
import { useMemo } from "react";
import { useTranslations } from "use-intl";

/** The editor's messages, which every label below reads. */
type EditorMessages = ReturnType<typeof useTranslations<"Editor">>;

/** The names of the formula editor that a formula opens, the same in an exam's prompt and in an answer. */
function formulaEditLabels(t: EditorMessages) {
  return {
    formula: t("formula"),
    invalid: t("formula-invalid"),
    keyboard: t("formula-keyboard"),
    keys: {
      chemistry: t("formula-chemistry"),
      delete: t("formula-delete"),
      functions: t("formula-functions"),
      greek: t("formula-greek"),
      left: t("formula-left"),
      numbers: t("formula-numbers"),
      physics: t("formula-physics"),
      right: t("formula-right"),
      symbols: t("formula-symbols"),
    },
    latex: t("latex"),
    open: t("formula-edit"),
    remove: t("formula-remove"),
  };
}

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
        addDescription: t("image-add-description"),
        alt: t("image-alt"),
        altHint: t("image-alt-hint"),
        cancel: t("image-cancel"),
        delete: t("image-delete"),
        edit: t("image-edit"),
        editDescription: t("image-edit-description"),
        save: t("image-save"),
      },
      formulaEdit: formulaEditLabels(t),
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
        italic: t("italic"),
        link: t("link"),
        linkInvalid: t("link-invalid"),
        linkPlaceholder: t("link-placeholder"),
        more: t("more"),
        numbers,
        quote,
        redo: t("redo"),
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
        undo: t("undo"),
      },
    };
  }, [t]);
}

/**
 * The names of a written answer's toolbar and of the formula editor its formulas open: history, the marks with the
 * link, the lists, the two formulas, and the Arabic keypad.
 */
export function useAnswerLabels() {
  const t = useTranslations("Editor");
  return useMemo(
    () => ({
      formulaEdit: formulaEditLabels(t),
      toolbar: {
        arabic: t("arabic"),
        bold: t("bold"),
        bullets: t("bullets"),
        code: t("code"),
        equation: t("equation"),
        formula: t("formula"),
        highlight: t("highlight"),
        italic: t("italic"),
        link: t("link"),
        linkInvalid: t("link-invalid"),
        linkPlaceholder: t("link-placeholder"),
        more: t("more"),
        numbers: t("numbers"),
        redo: t("redo"),
        strike: t("strike"),
        tasks: t("tasks"),
        underline: t("underline"),
        undo: t("undo"),
      },
    }),
    [t]
  );
}
