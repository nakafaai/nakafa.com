import { useMutation } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { MessageText } from "@repo/backend/confect/classroom/forum/message";
import { DiscussionTitle } from "@repo/backend/confect/classroom/forum/thread";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { randomUuid } from "@repo/utilities/uuid";
import { Effect, Option, Schema, String as Str } from "effect";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import {
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { openDiscussion } from "@/components/tenant/classes/forum/send";
import { useClassScope } from "@/components/tenant/classes/scope";
import { useViewerQuery } from "@/components/tenant/context";

/**
 * Opens a numbered discussion in the channel: a title and a first message. The dialog closes on
 * submit and the discussion shows at once at the bottom of the channel, and it takes its number
 * when the server answers. A refusal, such as a school that keeps discussions to teachers, brings
 * the dialog back with what was typed and says why, so nothing written is lost.
 */
export function StartDiscussion({
  channelId,
}: {
  channelId: Id<"classroomChannels">;
}) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const { classId, slug } = useClassScope();
  const open = useMutation(classroom.forum.threads.open);
  const viewer = useViewerQuery();
  const [shown, setShown] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [refusal, setRefusal] = useState<Option.Option<string>>(Option.none);
  const id = useId();
  const heading = Str.trim(title);
  const body = Str.trim(text);
  const ready =
    Schema.is(DiscussionTitle)(heading) &&
    Schema.is(MessageText)(body) &&
    viewer._tag === "Success";

  /** Brings the dialog back with what was typed and the reason the server gave. */
  const restore = (message: string) => {
    setTitle((current) => (current === "" ? heading : current));
    setText((current) => (current === "" ? body : current));
    setRefusal(Option.some(message));
    setShown(true);
  };

  /** Shows the discussion at once, sends it under a new key, and restores the dialog when refused. */
  const submit = () => {
    if (!ready) {
      return;
    }
    const { person } = viewer.value;
    setShown(false);
    setTitle("");
    setText("");
    setRefusal(Option.none());
    runForumCall(
      Effect.flatMap(randomUuid, (clientKey) =>
        openDiscussion(
          (update, args) => open.withOptimisticUpdate(update)(args),
          { id: person.id, name: person.name },
          {
            channelId,
            classId,
            clientKey,
            mentions: [],
            slug,
            text: body,
            title: heading,
          }
        ).pipe(
          Effect.catchTag("DiscussionsClosed", () =>
            Effect.sync(() => restore(t("discussions-closed")))
          )
        )
      ),
      () => {
        restore(t("discussion-failed"));
        toastForumFailure();
      }
    );
  };

  return (
    <>
      <Button onClick={() => setShown(true)}>{t("discussion-new")}</Button>
      <ResponsiveDialog
        description={t("discussion-new-description")}
        footer={
          <>
            <Button onClick={() => setShown(false)} variant="outline">
              {common("cancel")}
            </Button>
            <Button disabled={!ready} onClick={submit}>
              {t("discussion-start")}
            </Button>
          </>
        }
        open={shown}
        setOpen={setShown}
        title={t("discussion-new")}
      >
        <FieldGroup>
          <Field data-invalid={Option.isSome(refusal)}>
            <FieldLabel htmlFor={`${id}-title`}>
              {t("discussion-title")}
            </FieldLabel>
            <Input
              dir="auto"
              id={`${id}-title`}
              onChange={(event) => {
                setTitle(event.target.value);
                setRefusal(Option.none());
              }}
              placeholder={t("discussion-title-placeholder")}
              value={title}
            />
            <FieldError>{Option.getOrNull(refusal)}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-text`}>
              {t("discussion-text")}
            </FieldLabel>
            <Textarea
              className="min-h-28"
              dir="auto"
              id={`${id}-text`}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("discussion-first-placeholder")}
              value={text}
            />
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}
