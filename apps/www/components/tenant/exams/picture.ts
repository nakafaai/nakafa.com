import {
  type ImageRefusal,
  imageRefusal,
} from "@repo/design-system/components/editor/image";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Option } from "effect";
import type { PendingPicture } from "@/components/tenant/exams/editing";

/** The copy of the toast that says why a picture was not added: it is over the byte limit, or it is no PNG, JPEG, WebP, or GIF image. */
const REFUSAL_TOAST = {
  size: {
    description: "image-refused-size.description",
    title: "image-refused-size.title",
  },
  type: {
    description: "image-refused-type.description",
    title: "image-refused-type.title",
  },
} as const satisfies Record<
  ImageRefusal,
  { description: string; title: string }
>;

/** Tells the teacher why a file was not added as an image. */
export const refuseFile = (refusal: ImageRefusal) => {
  toast.error(REFUSAL_TOAST[refusal]);
};

/**
 * Queues a file the teacher chose or dropped for an editor, so its alt-text dialog opens next. A file
 * the editor cannot take is refused at once, with the reason, and nothing is queued.
 */
export const queuePictureFile = <E extends object>(
  queue: (picture: PendingPicture<E>) => void,
  editor: E,
  file: File
) =>
  Option.match(imageRefusal(file), {
    onNone: () => {
      queue({ editor, file });
    },
    onSome: refuseFile,
  });
