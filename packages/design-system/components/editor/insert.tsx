"use client";

import { FunctionIcon, FunctionSquareIcon } from "@hugeicons/core-free-icons";
import { NEW_FORMULA } from "@repo/design-system/components/editor/slash";
import { RichEditorControl } from "@repo/design-system/components/editor/tools";
import { useCurrentEditor } from "@tiptap/react";

/**
 * The controls that insert a formula: inline math inside the line, and block math on a line of
 * its own. Each inserts a placeholder formula, and its editor opens from the drawn formula.
 */
export function DocumentInsert({
  labels,
}: {
  labels: {
    equation: string;
    formula: string;
  };
}) {
  const { editor } = useCurrentEditor();

  return (
    <>
      <RichEditorControl
        icon={FunctionIcon}
        label={labels.formula}
        onClick={() =>
          editor
            ?.chain()
            .focus()
            .insertContent({
              attrs: { latex: NEW_FORMULA },
              type: "mathInline",
            })
            .run()
        }
      />
      <RichEditorControl
        icon={FunctionSquareIcon}
        label={labels.equation}
        onClick={() =>
          editor
            ?.chain()
            .focus()
            .insertContent({ attrs: { latex: NEW_FORMULA }, type: "mathBlock" })
            .run()
        }
      />
    </>
  );
}
