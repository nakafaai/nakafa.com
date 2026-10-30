import { Delete02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { altText } from "@repo/design-system/components/editor/image";
import { ToolHint } from "@repo/design-system/components/editor/tip";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ImageType } from "@repo/editor/upload";
import type { Editor } from "@tiptap/core";
import { FileHandler } from "@tiptap/extension-file-handler";
import {
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { Option, Schema } from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

/** The names of the pictures of an editor, in the reader's language. */
const PictureLabels = Schema.Struct({
  alt: Schema.String,
  altHint: Schema.String,
  cancel: Schema.String,
  delete: Schema.String,
  edit: Schema.String,
  editDescription: Schema.String,
  save: Schema.String,
});
type PictureLabels = typeof PictureLabels.Type;

/** What the pictures of an editor need: their names, the addresses they draw from, and the start of an upload. */
interface PictureContextValue {
  readonly begin: (file: File) => void;
  readonly labels: PictureLabels;
  readonly urls: Readonly<Record<string, string>>;
}

const PictureContext = createContext<PictureContextValue | null>(null);

/**
 * Gives the pictures of the editor inside it their names and addresses, and the start of an
 * upload. The addresses are the ones the page resolves for the document's images in one read.
 * `begin` takes a file the teacher chose, dropped, or pasted, and opens its alt-text dialog.
 */
export function PicturesProvider({
  begin,
  children,
  labels,
  urls,
}: PictureContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({ begin, labels, urls }), [begin, labels, urls]);
  return <PictureContext value={value}>{children}</PictureContext>;
}

/** The pictures' context, from the provider above the editor, which a picture needs to draw. */
export function usePictures(): PictureContextValue {
  const pictures = use(PictureContext);
  if (pictures === null) {
    // A picture is drawn only inside its editor, so a missing provider is a composition error.
    throw new Error("A picture requires PicturesProvider.");
  }
  return pictures;
}

/**
 * The address that previews a file the teacher chose. The address lives while the file does, and
 * it is revoked when the file changes or the editor closes.
 */
export function useObjectUrl(file: File | null): string | null {
  const url = useMemo(
    () => (file === null ? null : URL.createObjectURL(file)),
    [file]
  );
  useEffect(
    () => () => {
      if (url !== null) {
        URL.revokeObjectURL(url);
      }
    },
    [url]
  );
  return url;
}

/**
 * The alt-text dialog of a picture, which opens while it has a `preview` to show. It starts with
 * the picture's `alt` text, and the picture is changed once the alt text is not blank. The same
 * dialog adds a chosen file and edits the alt text of an image that the document holds.
 */
export function PictureAltDialog({
  alt,
  description,
  labels,
  onCancel,
  onConfirm,
  preview,
  submit,
  title,
}: {
  /** The alt text the dialog starts with: empty for a new picture. */
  readonly alt: string;
  /** The one sentence under the title that says what the dialog does. */
  readonly description: string;
  readonly labels: Pick<PictureLabels, "alt" | "altHint" | "cancel">;
  readonly onCancel: () => void;
  readonly onConfirm: (alt: string) => void;
  /** The address of the picture that the dialog shows, which opens the dialog when it is set. */
  readonly preview: string | null;
  /** The label of the button that confirms the alt text. */
  readonly submit: string;
  readonly title: string;
}) {
  const [text, setText] = useState(alt);
  // The text starts again from the picture's alt text whenever the dialog is given another
  // picture or another alt text. It changes only while a picture is shown, so a dialog that
  // closes keeps its text while it animates out. The change is made while rendering, so no
  // effect is needed.
  const [shown, setShown] = useState({ alt, preview });
  if (shown.alt !== alt || shown.preview !== preview) {
    setShown({ alt, preview });
    if (preview !== null) {
      setText(alt);
    }
  }

  const next = altText(text);
  const field = useId();

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      open={preview !== null}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (Option.isSome(next)) {
              onConfirm(next.value);
            }
          }}
        >
          <DialogPanel>
            <FieldGroup>
              {preview === null ? null : (
                <img
                  alt=""
                  className="max-h-64 rounded-md object-contain"
                  height={256}
                  src={preview}
                  width={256}
                />
              )}
              <Field>
                <FieldLabel htmlFor={field}>{labels.alt}</FieldLabel>
                <Input
                  id={field}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={labels.altHint}
                  value={text}
                />
              </Field>
            </FieldGroup>
          </DialogPanel>
          <DialogFooter>
            <Button onClick={onCancel} type="button" variant="outline">
              {labels.cancel}
            </Button>
            <Button disabled={Option.isNone(next)} type="submit">
              {submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One image of the document, drawn at its stored aspect ratio, so the box is reserved before the
 * image loads. A picture whose address is not resolved yet keeps its box as a placeholder. In an
 * editable document a small toolbar edits its alt text or deletes it; a reader has no toolbar.
 */
function PictureNode({
  deleteNode,
  editor,
  node,
  updateAttributes,
}: ReactNodeViewProps) {
  const { labels, urls } = usePictures();
  const [editing, setEditing] = useState(false);
  const { alt, asset, height, width } = node.attrs;
  const src: string | undefined = urls[asset];

  return (
    <NodeViewWrapper
      className="group relative my-2 block max-w-full"
      contentEditable={false}
      data-picture=""
      style={{ aspectRatio: `${width} / ${height}`, maxWidth: `${width}px` }}
    >
      {src === undefined ? (
        <div
          aria-label={alt}
          className="size-full rounded-md bg-muted"
          role="img"
        />
      ) : (
        <img
          alt={alt}
          className="size-full rounded-md object-contain"
          height={height}
          src={src}
          width={width}
        />
      )}
      {editor.isEditable ? (
        <div className="absolute end-2 top-2 flex gap-1 rounded-md bg-background/90 p-0.5 shadow-sm">
          <ToolHint label={labels.edit}>
            <Button
              aria-label={labels.edit}
              onClick={() => setEditing(true)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <HugeIcons icon={PencilEdit02Icon} />
            </Button>
          </ToolHint>
          <ToolHint label={labels.delete}>
            <Button
              aria-label={labels.delete}
              onClick={() => deleteNode()}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <HugeIcons icon={Delete02Icon} />
            </Button>
          </ToolHint>
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
