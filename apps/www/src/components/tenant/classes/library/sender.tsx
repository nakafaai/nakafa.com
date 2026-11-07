import { useAction, useMutation } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { LibraryFileType } from "@repo/backend/confect/classroom/library/item";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Option, Schema } from "effect";
import {
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import {
  sendLibraryFile,
  uploadLibraryFile,
} from "@/components/tenant/classes/library/add";
import {
  useLibraryFolder,
  useLibraryUploads,
} from "@/components/tenant/classes/library/scope";
import { useClassScope } from "@/components/tenant/classes/scope";

/** Tells the teacher that a file larger than the library keeps was not added. */
const refuseLargeFile = Effect.sync(() =>
  toast.error({
    description: "library-file-size.description",
    title: "library-file-size.title",
  })
);

/** Tells the teacher that a file whose bytes name no PDF or image was not added. */
const refuseOtherFile = Effect.sync(() =>
  toast.error({
    description: "library-file-type.description",
    title: "library-file-type.title",
  })
);

/** Tells the teacher that the school's storage, or the day's free uploads, are used up. */
const refuseFullStorage = Effect.sync(() =>
  toast.error({
    description: "library-storage-full.description",
    title: "library-storage-full.title",
  })
);

/** What a refused file tells the teacher, by the refusal the server answered. */
export const fileRefusals = {
  FileSizeRefused: () => refuseLargeFile,
  FileTypeRefused: () => refuseOtherFile,
};

/**
 * Sends files of the device to the library at the page's folder: each one's row shows at once with its progress,
 * reserves its bytes, goes straight to R2, and registers. A file of another type is refused before anything moves,
 * and a refusal of the server takes its row away and says why.
 */
export function useFileSender() {
  const { classId, slug } = useClassScope();
  const uploads = useLibraryUploads();
  const folderId = useLibraryFolder();
  const reserve = useMutation(classroom.library.reserve);
  const register = useAction(classroom.library.register);

  return (author: string, file: File, title: string) => {
    const contentType = Schema.decodeUnknownOption(LibraryFileType)(file.type);
    if (Option.isNone(contentType)) {
      Effect.runSync(refuseOtherFile);
      return;
    }
    const kind = contentType.value === "application/pdf" ? "pdf" : "image";
    runForumCall(
      sendLibraryFile(
        uploads.getState(),
        { author, kind, title },
        (clientKey) =>
          uploadLibraryFile(
            file,
            () =>
              reserve({
                byteSize: file.size,
                classId,
                clientKey,
                contentType: contentType.value,
                folderId,
                slug,
                title,
              }),
            (uploadId) => register({ classId, slug, uploadId }),
            (fraction) => uploads.getState().advance(clientKey, fraction)
          )
      ).pipe(
        Effect.catchTags({
          FileSizeRefused: () => refuseLargeFile,
          FileTypeRefused: () => refuseOtherFile,
          StorageFull: () => refuseFullStorage,
        })
      ),
      toastForumFailure
    );
  };
}
