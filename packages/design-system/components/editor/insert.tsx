import {
  CodeSquareIcon,
  FunctionIcon,
  FunctionSquareIcon,
  ImageUploadIcon,
  QuoteDownIcon,
} from "@hugeicons/core-free-icons";
import { usePictures } from "@repo/design-system/components/editor/picture";
import { EditorTools } from "@repo/design-system/components/editor/tools";
import { ImageType } from "@repo/editor/upload";
import { useCurrentEditor, useEditorState } from "@tiptap/react";
import { Array as Arr } from "effect";
import { useRef } from "react";

/**
 * The blocks an assessment document takes besides its text, each its own control: a quote and a code
 * block, pressed while the caret sits in them, a formula, inline or on a line of its own, pressed while
 * one is selected, and an image, which the teacher picks from the device. A formula control turns the
 * selected text into a formula and a selected formula back into text; with nothing selected it inserts a
 * formula whose editor opens at once. A picked image starts its alt-text dialog.
 */
export function DocumentInsert({
  labels,
}: {
  labels: {
    codeBlock: string;
    equation: string;
    formula: string;
    image: string;
    quote: string;
  };
}) {
  const { editor } = useCurrentEditor();
  const { begin } = usePictures();
  const picker = useRef<HTMLInputElement>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      codeBlock: current?.isActive("codeBlock") ?? false,
      equation: current?.isActive("mathBlock") ?? false,
      formula: current?.isActive("mathInline") ?? false,
      quote: current?.isActive("blockquote") ?? false,
    }),
  });

  return (
    <>
      <EditorTools
        tools={[
          {
            active: state?.quote ?? false,
            icon: QuoteDownIcon,
            label: labels.quote,
            name: "quote",
            run: () => editor?.chain().focus().toggleBlockquote().run(),
          },
          {
            active: state?.codeBlock ?? false,
            icon: CodeSquareIcon,
            label: labels.codeBlock,
            name: "code-block",
            run: () => editor?.chain().focus().toggleCodeBlock().run(),
          },
          {
            active: state?.formula ?? false,
            icon: FunctionIcon,
            label: labels.formula,
            name: "formula",
            run: () =>
              editor?.chain().focus().toggleFormula("mathInline").run(),
          },
          {
            active: state?.equation ?? false,
            icon: FunctionSquareIcon,
            label: labels.equation,
            name: "equation",
            run: () => editor?.chain().focus().toggleFormula("mathBlock").run(),
          },
          {
            icon: ImageUploadIcon,
            label: labels.image,
            name: "image",
            run: () => picker.current?.click(),
          },
        ]}
      />
      <input
        accept={Arr.join(ImageType.literals, ",")}
        aria-hidden
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            begin(file);
          }
        }}
        ref={picker}
        tabIndex={-1}
        type="file"
      />
    </>
  );
}
