"use client";

import {
  altText,
  IMAGE_MEDIA_TYPES,
} from "@repo/design-system/components/editor/image";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { FileHandler } from "@tiptap/extension-file-handler";
import {
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { Option } from "effect";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";

/** The names of the pictures of an editor, in the reader's language. */
type PictureLabels = ComponentProps<typeof PictureAltDialog>["labels"];

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
 * The alt-text dialog of a picture the teacher has chosen. The image is shown from a local
 * address while the teacher types, and the picture is added once the alt text is not blank.
 */
export function PictureAltDialog({
  file,
  labels,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  labels: {
    readonly add: string;
    readonly alt: string;
    readonly altHint: string;
    readonly cancel: string;
    readonly delete: string;
    readonly edit: string;
  };
  onCancel: () => void;
  onConfirm: (alt: string) => void;
}) {
  const [text, setText] = useState("");
  const preview = useMemo(
    () => (file === null ? null : URL.createObjectURL(file)),
    [file]
  );

  useEffect(() => {
    setText("");
    return () => {
      if (preview !== null) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const alt = altText(text);

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      open={file !== null}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{labels.add}</DialogTitle>
        </DialogHeader>
        {preview === null ? null : (
          // biome-ignore lint/performance/noImgElement: a local preview of the file the teacher chose, which Next.js cannot optimise.
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
            if (Option.isSome(alt)) {
              onConfirm(alt.value);
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
            <Button disabled={Option.isNone(alt)} type="submit">
              {labels.add}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One image of the document, drawn at its stored aspect ratio, so the box is reserved before the
 * image loads. A picture whose address is not resolved yet keeps its box as a placeholder.
 */
function PictureNode({ node }: ReactNodeViewProps) {
  const { labels, urls } = usePictures();
  const { alt, asset, height, width } = node.attrs;
  const src: string | undefined = urls[asset];

  return (
    <NodeViewWrapper
      className="my-2 block max-w-full"
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
      <span className="sr-only">{labels.edit}</span>
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
    allowedMimeTypes: [...IMAGE_MEDIA_TYPES],
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
