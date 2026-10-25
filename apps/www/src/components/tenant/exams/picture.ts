import {
  type ImageRefusal,
  imageRefusal,
} from "@repo/design-system/components/editor/image";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Option } from "effect";
import type { PendingPicture } from "@/components/tenant/exams/editing";

/** Tells the teacher why a file was not added as an image: it is over the byte limit, or it is no PNG, JPEG, WebP, or GIF image. */
export const refuseFile = (refusal: ImageRefusal) => {
  if (refusal === "size") {
    toast.error({
      description: "image-refused-size.description",
      title: "image-refused-size.title",
    });
    return;
  }
  toast.error({
    description: "image-refused-type.description",
    title: "image-refused-type.title",
  });
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
