"use client";

import {
  FunctionIcon,
  FunctionSquareIcon,
  ImageUploadIcon,
} from "@hugeicons/core-free-icons";
import { usePictures } from "@repo/design-system/components/editor/picture";
import { NEW_FORMULA } from "@repo/design-system/components/editor/slash";
import { RichEditorControl } from "@repo/design-system/components/editor/tools";
import { ImageType } from "@repo/editor/image";
import { useCurrentEditor } from "@tiptap/react";
import { Array as Arr } from "effect";
import { useRef } from "react";

/**
 * The controls that insert the content of an assessment document that is not text: a formula,
 * inline or on a line of its own, and an image, which the teacher picks from the device. A
 * formula inserts a placeholder that its editor changes, and a picked image starts its alt-text
 * dialog.
 */
export function DocumentInsert({
  labels,
}: {
  labels: {
    equation: string;
    formula: string;
    image: string;
  };
}) {
  const { editor } = useCurrentEditor();
  const { begin } = usePictures();
  const picker = useRef<HTMLInputElement>(null);

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
            .insertContent({
              attrs: { latex: NEW_FORMULA },
              type: "mathBlock",
            })
            .run()
        }
      />
      <RichEditorControl
        icon={ImageUploadIcon}
        label={labels.image}
        onClick={() => picker.current?.click()}
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
