import type { Ref } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import type classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Clock, Effect, type Result, Schema } from "effect";
import { forumCall } from "@/components/tenant/classes/forum/call";
import {
  addLinkUpdate,
  type LibraryItem,
} from "@/components/tenant/classes/library/optimistic";

/** The arguments of one link, as the dialog gives them. */
type LinkArgs = Ref.Args<typeof classroom.library.addLink>;

/** The ID of an uploaded file in Convex storage, as the upload address answers it. */
const storageIdSchema = Id("_storage");

/**
 * The link the teacher adds, shown at once first in the library under its client key, which is
 * its placeholder ID until the server answers. `add` is Confect's mutation with the optimistic
 * update it is given.
 */
export const addLibraryLink = Effect.fn("classroom.library.addLink")(function* <
  E,
>(
  add: (
    update: ReturnType<typeof addLinkUpdate>,
    args: LinkArgs
  ) => Promise<Result.Result<LibraryItem, E>>,
  author: string,
  args: LinkArgs
) {
  const createdAt = yield* Clock.currentTimeMillis;
  const id = yield* Schema.decodeUnknownEffect(Id("classroomLibrary"))(
    args.clientKey
  );
  return yield* forumCall(() =>
    add(
      addLinkUpdate({
        address: args.address,
        author,
        byteSize: null,
        clientKey: args.clientKey,
        createdAt,
        id,
        kind: "link",
        title: args.title,
      }),
      args
    )
  );
});

/**
 * Adds one file to the library: it asks for an upload address, sends the file to it, and
 * registers the stored file, which the server checks before it keeps it. The module that sends
 * the file, and Effect's HTTP client with it, loads only now, so the page's first JavaScript does
 * not carry it.
 */
export const uploadLibraryFile = Effect.fn("classroom.library.upload")(
  function* <UrlError, RegisterError, Registered>(
    file: File,
    requestUrl: () => Promise<Result.Result<URL, UrlError>>,
    register: (
      storageId: typeof storageIdSchema.Type
    ) => Promise<Result.Result<Registered, RegisterError>>
  ) {
    const url = yield* forumCall(requestUrl);
    const { sendStorageFile } = yield* Effect.tryPromise(
      () => import("@/components/tenant/exams/image")
    );
    const storageId = yield* sendStorageFile(url, file);
    return yield* forumCall(() => register(storageId));
  }
);
