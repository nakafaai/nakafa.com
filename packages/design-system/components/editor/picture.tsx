import { Delete02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { objectBar } from "@repo/design-system/components/editor/bar";
import { altText } from "@repo/design-system/components/editor/image";
      {editor.isEditable && selected ? (
        <div
          aria-label={alt}
          className={cn(objectBar(), "absolute start-0 bottom-full mb-2")}
          role="toolbar"
        >
          <RichEditorControl
            icon={PencilEdit02Icon}
            label={labels.edit}
            onClick={() => setEditing(true)}
          />
          <RichEditorControl
            icon={Delete02Icon}
            label={labels.delete}
            onClick={() => {
              deleteNode();
              editor.commands.focus();
            }}
          />
        </div>
      ) : null}
      <PictureAltDialog
        alt={alt}
        description={labels.editDescription}
        labels={labels}
        onCancel={() => setEditing(false)}
        onConfirm={(next) => {
          updateAttributes({ alt: next });
          setEditing(false);
        }}
        preview={editing ? (src ?? null) : null}
        submit={labels.save}
        title={labels.edit}
      />
    </NodeViewWrapper>
  );
}

/** The view that draws an image of the document, which the editor's extensions give it. */
export const PICTURE_VIEW = ReactNodeViewRenderer(PictureNode);

/**
 * The file handler of the editor: a file pasted or dropped into the text starts the alt-text
 * dialog, which goes into the editor the file arrived in. Only the image types the editor takes
 * are handled, and any other file is left alone.
 */
export const pictureFileHandler = (
  begin: (file: File, editor: Editor) => void
) =>
  FileHandler.configure({
    allowedMimeTypes: [...ImageType.literals],
    onDrop: (editor, files) => {
      for (const file of files) {
        begin(file, editor);
      }
    },
    onPaste: (editor, files) => {
      for (const file of files) {
        begin(file, editor);
      }
    },
  });
