import { useAction, useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  PictureAltDialog,
  PicturesProvider,
  useObjectUrl,
} from "@repo/design-system/components/editor/picture";
import { DocumentToolbar } from "@repo/design-system/components/editor/toolbar";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Effect, Option } from "effect";
import { useCallback } from "react";
import type { PendingPicture } from "@/components/tenant/exams/editing";
import { storeExamImage } from "@/components/tenant/exams/image";
import {
  queuePictureFile,
  refuseFile,
} from "@/components/tenant/exams/picture";
import {
  useExam,
  useExamEditing,
  useExamLocked,
} from "@/components/tenant/exams/provider";
import { reportClientException } from "@/lib/analytics/client";
import { useDocumentLabels } from "@/lib/editor/labels";

/** No picture of the toolbar is drawn, so it resolves no addresses. */
const NO_ADDRESSES: Readonly<Record<string, string>> = {};

/** Where the toolbar reports the pictures it could not place. */
const SOURCE = "components/tenant/exams/toolbar";

/** Tells the teacher that a picture of more than the byte limit was not added. */
const refuseLargePicture = () => Effect.sync(() => refuseFile("size"));

/** Tells the teacher that a file that is no PNG, JPEG, WebP, or GIF image was not added. */
const refuseOtherPicture = () => Effect.sync(() => refuseFile("type"));

/**
 * The formatting toolbar of the exam, in the row under the header. It acts on the active editor, the
 * prompt or the option that took focus last, and every control is disabled while there is none, or
 * while the exam is frozen. The picture and formula controls insert into the active editor too: a
 * picture waits for its alt text in the dialog that this row holds, and then goes into the editor
 * it was chosen for.
 */
export function ExamToolbar() {
  const labels = useDocumentLabels();
  const { exam, slug } = useExam();
  const frozen = useExamLocked();
  const active = useExamEditing((state) => state.active);
  const pictures = useExamEditing((state) => state.pictures);
  const queuePicture = useExamEditing((state) => state.queuePicture);
  const shiftPicture = useExamEditing((state) => state.shiftPicture);
  const requestUrl = useMutation(exams.assets.uploadUrl);
  const register = useAction(exams.assets.register);
  const chosen = Option.getOrNull(Arr.head(pictures));
  const preview = useObjectUrl(chosen === null ? null : chosen.file);
  const canEdit = active?.isEditable === true && !frozen;

  /** Queues a file the teacher chose for the active editor. */
  const begin = useCallback(
    (file: File) => {
      if (active !== null) {
        queuePictureFile(queuePicture, active, file);
      }
    },
    [active, queuePicture]
  );

  /** Stores the confirmed picture as an image of this exam, then places it in the editor it was chosen for. */
  const confirm = (alt: string) => {
    if (chosen !== null) {
      Effect.runFork(insertPicture(chosen, alt));
    }
    shiftPicture();
  };

  /** Stores the picture as an image of this exam and places it at the caret of its editor. A refused file leaves the text as it was. */
  const insertPicture = (picture: PendingPicture, alt: string) =>
    storeExamImage({
      file: picture.file,
      register: (args) => register({ examId: exam.id, slug, ...args }),
      requestUrl: () => requestUrl({ examId: exam.id, slug }),
    }).pipe(
      Effect.tap((stored) =>
        Effect.sync(() => {
          const { editor } = picture;
          if (editor.isDestroyed) {
            return;
          }
          const { state, view } = editor;
          view.dispatch(
            state.tr.replaceSelectionWith(
              state.schema.nodes.image.create({
                alt,
                asset: stored.id,
                height: stored.height,
                width: stored.width,
              })
            )
          );
        })
      ),
      Effect.catchTags({
        AssetSizeRefused: refuseLargePicture,
        AssetTypeRefused: refuseOtherPicture,
        ImageUnreadable: refuseOtherPicture,
      }),
      Effect.catch((error) =>
        reportClientException(error, { source: SOURCE }).pipe(
          Effect.andThen(
            Effect.sync(() =>
              toast.error({
                description: "action-error.description",
                title: "action-error.title",
              })
            )
          )
        )
      )
    );

  return (
    <>
      <PicturesProvider
        begin={begin}
        labels={labels.pictures}
        urls={NO_ADDRESSES}
      >
        <fieldset className="min-w-0" disabled={!canEdit}>
          <DocumentToolbar editor={active} labels={labels.toolbar} />
        </fieldset>
      </PicturesProvider>
      <PictureAltDialog
        alt=""
        labels={labels.pictures}
        onCancel={shiftPicture}
        onConfirm={confirm}
        preview={preview}
        submit={labels.pictures.add}
        title={labels.pictures.add}
      />
    </>
  );
}
