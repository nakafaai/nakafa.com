import {
  CodeSquareIcon,
  FunctionIcon,
  FunctionSquareIcon,
  ImageUploadIcon,
  PlusSignIcon,
  QuoteDownIcon,
} from "@hugeicons/core-free-icons";
import { usePictures } from "@repo/design-system/components/editor/picture";
import { NEW_FORMULA } from "@repo/design-system/components/editor/slash";
import { EditorMenu } from "@repo/design-system/components/editor/tools";
import { ImageType } from "@repo/editor/upload";
import { useCurrentEditor, useEditorState } from "@tiptap/react";
import { Array as Arr } from "effect";
import { useRef } from "react";

/**
 * The blocks an assessment document takes besides its text, in one menu: a quote and a code
 * block, which show their check while the caret sits in them, a formula, inline or on a line of
 * its own, and an image, which the teacher picks from the device. A formula inserts a
 * placeholder that its editor changes, and a picked image starts its alt-text dialog.
 */
export function DocumentInsert({
  labels,
}: {
  labels: {
    codeBlock: string;
    equation: string;
    formula: string;
    image: string;
    insert: string;
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
      quote: current?.isActive("blockquote") ?? false,
    }),
  });

  return (
    <>
      <EditorMenu
        icon={PlusSignIcon}
        label={labels.insert}
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
            icon: FunctionIcon,
            label: labels.formula,
            name: "formula",
            run: () =>
              editor
                ?.chain()
                .focus()
                .insertContent({
                  attrs: { latex: NEW_FORMULA },
                  type: "mathInline",
                })
                .run(),
          },
          {
            icon: FunctionSquareIcon,
            label: labels.equation,
            name: "equation",
            run: () =>
              editor
                ?.chain()
                .focus()
                .insertContent({
                  attrs: { latex: NEW_FORMULA },
                  type: "mathBlock",
                })
                .run(),
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
