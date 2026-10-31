import { QueryResult, useAction, useMutation, useQuery } from "@confect/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  AUDIO_BYTE_LIMIT,
  MEDIA_MAX,
  type QuestionMedia,
  videoIdOf,
} from "@repo/backend/confect/exams/media";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Array as Arr,
  Effect,
  Function as Fn,
  Option,
  String as Str,
} from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { PaperMedia } from "@/components/exams/sitting/media";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import { mediaUpdate } from "@/components/tenant/exams/attached";
import { sendStorageFile } from "@/components/tenant/exams/image";
import type { Question } from "@/components/tenant/exams/optimistic";
import { useExam } from "@/components/tenant/exams/provider";

/** The audio files a teacher picks from. */
const AUDIO_FILES =
  "audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav";

/** The way a dialog adds media. */
type MediaKind = QuestionMedia["kind"];

/** The media of a question on its paper, as the student meets it, read for the editor and the try. */
export function ExamPaperMedia({ question }: { readonly question: Question }) {
  const { exam, slug } = useExam();
  const reply = useQuery(
    exams.assets.media,
    Arr.isReadonlyArrayEmpty(question.media)
      ? "skip"
      : { examId: exam.id, questionId: question.id, slug }
  );

  return QueryResult.isSuccess(reply) ? (
    <PaperMedia items={reply.value} />
  ) : null;
}

/** The dialog that adds one piece of media: a clip from the device, or a video by its link, and what it holds. */
function MediaDialog({
  kind,
  onAdd,
  onClose,
}: {
  readonly kind: MediaKind;
  readonly onAdd: (media: {
    readonly alt: string;
    readonly file: File | null;
    readonly video: string;
  }) => void;
  readonly onClose: () => void;
}) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const id = useId();
  const [alt, setAlt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [open, setOpen] = useState(true);
  const video = videoIdOf(link);
  const tooLarge = file !== null && file.size > AUDIO_BYTE_LIMIT;
  const ready =
    Str.isNonEmpty(Str.trim(alt)) &&
    (kind === "audio" ? file !== null && !tooLarge : Option.isSome(video));

  return (
    <ResponsiveDialog
      description={t(
        kind === "audio" ? "media-audio-hint" : "media-video-hint"
      )}
      footer={
        <>
          <Button onClick={() => setOpen(false)} variant="outline">
            {common("cancel")}
          </Button>
          <Button
            disabled={!ready}
            onClick={() => {
              onAdd({
                alt: Str.trim(alt),
                file,
                video: Option.getOrElse(video, () => ""),
              });
              setOpen(false);
            }}
          >
            {common("save")}
          </Button>
        </>
      }
      onOpenChangeComplete={(next) => {
        if (!next) {
          onClose();
        }
      }}
      open={open}
      setOpen={setOpen}
      title={t(kind === "audio" ? "media-add-audio" : "media-add-video")}
    >
      <FieldGroup>
        {kind === "audio" ? (
          <Field>
            <FieldLabel htmlFor={`${id}-file`}>{t("media-file")}</FieldLabel>
            <Input
              accept={AUDIO_FILES}
              aria-invalid={tooLarge}
              id={`${id}-file`}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            <FieldDescription>{t("media-file-limit")}</FieldDescription>
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor={`${id}-link`}>{t("media-link")}</FieldLabel>
            <Input
              dir="ltr"
              id={`${id}-link`}
              inputMode="url"
              onChange={(event) => setLink(event.target.value)}
              value={link}
            />
            <FieldDescription>{t("media-link-hint")}</FieldDescription>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor={`${id}-alt`}>{t("media-alt")}</FieldLabel>
          <Input
            dir="auto"
            id={`${id}-alt`}
            onChange={(event) => setAlt(event.target.value)}
            value={alt}
          />
          <FieldDescription>{t("media-alt-hint")}</FieldDescription>
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}

/**
 * The media of a question in the teacher's panel: what it holds, each with a way to remove it, and the actions that
 * add a clip or a video while it holds fewer than the most a question takes. A removal shows at once and rolls back
 * when the server refuses it. A clip shows once it has reached the server.
 */
export function MediaField({
  editable,
  question,
}: {
  /** Whether the teacher may change the media now. */
  readonly editable: boolean;
  /** The question as the server holds it. */
  readonly question: Question;
}) {
  const t = useTranslations("Exams");
  const { exam, slug } = useExam();
  const [adding, setAdding] = useState<MediaKind | null>(null);
  const [isPending, startTransition] = useTransition();
  const save = useMutation(exams.questions.media).withOptimisticUpdate(
    mediaUpdate
  );
  const requestUrl = useMutation(exams.assets.uploadUrl);
  const register = useAction(exams.assets.registerAudio);

  /** Saves the question's media with one piece more or less. */
  const saveMedia = (media: readonly QuestionMedia[]) =>
    sentAction(() =>
      save({ examId: exam.id, media, questionId: question.id, slug })
    );

  /** Uploads a clip, registers it as the exam's, and adds it to the question. */
  const addClip = (file: File, alt: string) =>
    sentAction(() => requestUrl({ examId: exam.id, slug })).pipe(
      Effect.flatMap((url) => sendStorageFile(url, file)),
      Effect.flatMap((storageId) =>
        sentAction(() => register({ examId: exam.id, slug, storageId }))
      ),
      Effect.flatMap(({ id }) =>
        saveMedia([...question.media, { alt, asset: id, kind: "audio" }])
      )
    );

  return (
    <Field>
      <FieldTitle>{t("media")}</FieldTitle>
      <ul className="grid gap-1">
        {Arr.map(question.media, (item, index) => (
          <li
            className="flex items-center justify-between gap-2 text-sm"
            key={item.kind === "audio" ? item.asset : item.video}
          >
            <span className="min-w-0 truncate" dir="auto">
              {item.alt}
            </span>
            <Button
              aria-label={t("media-remove", { name: item.alt })}
              disabled={!editable}
              onClick={() =>
                runExamAction(saveMedia(Arr.remove(question.media, index)), {
                  onFailure: Fn.constVoid,
                  onSuccess: Fn.constVoid,
                })
              }
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <HugeIcons aria-hidden="true" icon={Cancel01Icon} />
            </Button>
          </li>
        ))}
      </ul>
      {question.media.length < MEDIA_MAX ? (
        <div className="flex gap-2">
          <Button
            disabled={!editable || isPending}
            onClick={() => setAdding("audio")}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("media-add-audio")}
          </Button>
          <Button
            disabled={!editable}
            onClick={() => setAdding("video")}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("media-add-video")}
          </Button>
        </div>
      ) : null}
      {adding === null ? null : (
        <MediaDialog
          kind={adding}
          onAdd={({ alt, file, video }) =>
            startTransition(async () => {
              await runExamAction(
                file === null
                  ? saveMedia([
                      ...question.media,
                      { alt, kind: "video", video },
                    ])
                  : addClip(file, alt),
                { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
              );
            })
          }
          onClose={() => setAdding(null)}
        />
      )}
    </Field>
  );
}
