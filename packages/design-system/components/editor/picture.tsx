"use client";

import { Delete02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { altText } from "@repo/design-system/components/editor/image";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ImageType } from "@repo/editor/image";
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
  labels,
  onCancel,
  onConfirm,
  preview,
  submit,
  title,
}: {
  /** The alt text the dialog starts with: empty for a new picture. */
  readonly alt: string;
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
  // picture or another alt text. The change is made while rendering, so no effect is needed.
  const [shown, setShown] = useState({ alt, preview });
  if (shown.alt !== alt || shown.preview !== preview) {
    setShown({ alt, preview });
    setText(alt);
  }

  const next = altText(text);

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
        </DialogHeader>
        {preview === null ? null : (
          // biome-ignore lint/performance/noImgElement: a local preview of the file the teacher chose, or an address that Next.js cannot optimise.
          <img
            alt=""
            className="max-h-64 rounded-md object-contain"
            height={256}
            src={preview}
            width={256}
          />
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (Option.isSome(next)) {
              onConfirm(next.value);
            }
          }}
        >
          <div className="flex flex-col gap-1 text-sm">
            <span>{labels.alt}</span>
            <Input
              aria-label={labels.alt}
              onChange={(event) => setText(event.target.value)}
              placeholder={labels.altHint}
              value={text}
            />
          </div>
          <DialogFooter>
            <Button onClick={onCancel} type="button" variant="ghost">
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
        // biome-ignore lint/performance/noImgElement: the file is served from Convex storage through its own address.
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
          <Button
            aria-label={labels.edit}
            onClick={() => setEditing(true)}
            size="icon-sm"
            title={labels.edit}
            type="button"
            variant="ghost"
          >
            <HugeIcons icon={PencilEdit02Icon} />
          </Button>
          <Button
            aria-label={labels.delete}
            onClick={() => deleteNode()}
            size="icon-sm"
            title={labels.delete}
            type="button"
            variant="ghost"
          >
            <HugeIcons icon={Delete02Icon} />
          </Button>
        </div>
      ) : null}
      <PictureAltDialog
        alt={alt}
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
 * dialog. Only the image types the editor takes are handled, and any other file is left alone.
 */
export const pictureFileHandler = (begin: (file: File) => void) =>
  FileHandler.configure({
    allowedMimeTypes: [...ImageType.literals],
    onDrop: (_editor, files) => {
      for (const file of files) {
        begin(file);
      }
    },
    onPaste: (_editor, files) => {
      for (const file of files) {
        begin(file);
      }
    },
  });
