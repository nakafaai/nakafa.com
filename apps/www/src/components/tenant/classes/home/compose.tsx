import { useMutation } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { PostText } from "@repo/backend/confect/classroom/posts/post";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { DateTimePicker } from "@repo/design-system/components/ui/date";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
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
import { publishPost } from "@/components/tenant/classes/home/publish";
import { scheduleAnnouncement } from "@/components/tenant/classes/home/waiting";
import { useClassScope } from "@/components/tenant/classes/scope";
import { deadlineOf } from "@/components/tenant/classes/tasks/deadline";
import { useViewerQuery } from "@/components/tenant/context";
import { SchoolHeaderAdd } from "@/components/tenant/header";
import { useClockZone } from "@/components/tenant/settings/time";

/**
 * Posts an announcement to the class, or keeps it for a time the teacher chooses: its text, and whether it also goes
 * by email (ADR 0027). The dialog closes on submit and the announcement shows at once on the class home. A send that
 * fails brings the dialog back with what was written, so nothing is lost.
 */
export function NewAnnouncement() {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const { classId, slug } = useClassScope();
  const publish = useMutation(classroom.posts.publish);
  const schedule = useMutation(classroom.scheduled.schedule);
  const viewer = useViewerQuery();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [email, setEmail] = useState(false);
  const [later, setLater] = useState(false);
  const [when, setWhen] = useState("");
  const id = useId();
  const body = Str.trim(text);
  const publishAt = deadlineOf(when, useClockZone());
  const ready =
    Schema.is(PostText)(body) &&
    viewer._tag === "Success" &&
    (!later || Option.isSome(publishAt));

  /** Shows the announcement at once, sends it under a new key, and restores the dialog when it fails. */
  const submit = () => {
    if (!ready) {
      return;
    }
    const { person } = viewer.value;
    setOpen(false);
    setText("");
    setEmail(false);
    setLater(false);
    setWhen("");
    runForumCall(
      Effect.flatMap(randomUuid, (clientKey) =>
        later && Option.isSome(publishAt)
          ? scheduleAnnouncement(
              (update, args) => schedule.withOptimisticUpdate(update)(args),
              {
                classId,
                clientKey,
                email,
                publishAt: publishAt.value,
                slug,
                text: body,
              }
            ).pipe(Effect.asVoid)
          : publishPost(
              (update, args) => publish.withOptimisticUpdate(update)(args),
              { id: person.id, name: person.name },
              { classId, clientKey, email, poll: null, slug, text: body }
            ).pipe(Effect.asVoid)
      ),
      () => {
        setText((current) => (current === "" ? body : current));
        setEmail(email);
        setLater(later);
        setWhen(when);
        setOpen(true);
        toastForumFailure();
      }
    );
  };

  return (
    <>
      <SchoolHeaderAdd label={t("post-new")} onClick={() => setOpen(true)} />
      <ResponsiveDialog
        description={t("post-new-description")}
        footer={
          <>
            <Button onClick={() => setOpen(false)} variant="outline">
              {common("cancel")}
            </Button>
            <Button disabled={!ready} onClick={submit}>
              {t(later ? "post-schedule-submit" : "post-submit")}
            </Button>
          </>
        }
        open={open}
        setOpen={setOpen}
        title={t("post-new")}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-text`}>{t("post-text")}</FieldLabel>
            <Textarea
              className="min-h-32"
              dir="auto"
              id={`${id}-text`}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("announcement-placeholder")}
              value={text}
            />
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              checked={email}
              id={`${id}-email`}
              onCheckedChange={(next) => setEmail(next)}
            />
            <FieldLabel htmlFor={`${id}-email`}>{t("post-email")}</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              checked={later}
              id={`${id}-later`}
              onCheckedChange={(next) => setLater(next)}
            />
            <FieldLabel htmlFor={`${id}-later`}>
              {t("post-schedule")}
            </FieldLabel>
          </Field>
          {later ? (
            <Field>
              <FieldLabel htmlFor={`${id}-when`}>
                {t("post-schedule-when")}
              </FieldLabel>
              <DateTimePicker
                dayPlaceholder={t("task-day-placeholder")}
                id={`${id}-when`}
                onValueChange={setWhen}
                timePlaceholder={t("task-time-placeholder")}
                value={when}
              />
            </Field>
          ) : null}
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}
