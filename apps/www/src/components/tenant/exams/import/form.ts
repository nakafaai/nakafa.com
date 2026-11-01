import type { Ref } from "@confect/core";
import type exams from "@repo/backend/confect/_generated/refs/exams";
import type { PlacedQuestion } from "@repo/backend/confect/exams/import";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Data, Effect, Option, type Result } from "effect";
import { forumCall } from "@/components/tenant/classes/forum/call";
import type { DriveFile } from "@/components/tenant/classes/library/drive";

/** The file type of a Google Form, which the Picker offers. */
export const FORM_TYPE = "application/vnd.google-apps.form";

/** The account has no Drive connection, which reads a form. */
export class FormDriveMissing extends Data.TaggedError("FormDriveMissing") {}

/** What one import of a form calls. */
type FormCalls<PickError, ReadError, PlaceError> = Readonly<{
  pick: Effect.Effect<Option.Option<DriveFile>, PickError>;
  place: (
    questions: readonly PlacedQuestion[]
  ) => Promise<
    Result.Result<Ref.Returns<typeof exams.imports.place>, PlaceError>
  >;
  read: (
    formId: string
  ) => Promise<Result.Result<readonly PlacedQuestion[] | null, ReadError>>;
}>;

/**
 * Imports a picked Google Form at the end of the exam, through the placement a file's questions
 * take. A question without an answer key stays keyless for the teacher to complete, and a question
 * that is no single choice of two to five options is left out, as in a file. Closing the Picker
 * changes nothing.
 */
export const importForm = Effect.fn("exams.import.form")(function* <
  PickError,
  ReadError,
  PlaceError,
>({ pick, place, read }: FormCalls<PickError, ReadError, PlaceError>) {
  const picked = yield* pick;
  if (Option.isNone(picked)) {
    return;
  }
  const questions = yield* forumCall(() => read(picked.value.id));
  if (questions === null) {
    return yield* new FormDriveMissing();
  }
  const placed = yield* forumCall(() => place(questions));
  if (placed.placed.length === 0) {
    toast.info({
      description: "import-empty.description",
      title: "import-empty.title",
    });
    return;
  }
  toast.success(
    placed.keyless === 0
      ? { description: "import-done.description", title: "import-done.title" }
      : {
          description: "import-keyless.description",
          title: "import-keyless.title",
        }
  );
});
