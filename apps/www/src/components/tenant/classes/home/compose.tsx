import { useMutation } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { PostText } from "@repo/backend/confect/classroom/posts/post";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { randomUuid } from "@repo/utilities/uuid";
import { Effect, Schema, String as Str } from "effect";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import {
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { publishPost } from "@/components/tenant/classes/home/publish";
import { useClassScope } from "@/components/tenant/classes/scope";
import { useViewerQuery } from "@/components/tenant/context";

/**
 * Posts an announcement to the class: its text, and whether it also goes by email (ADR 0027). The
 * dialog closes on submit and the announcement shows at once first on the class home. A send that
 * fails brings the dialog back with what was written, so nothing is lost.
 */
export function NewAnnouncement() {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const { classId, slug } = useClassScope();
  const publish = useMutation(classroom.posts.publish);
  const viewer = useViewerQuery();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [email, setEmail] = useState(false);
  const id = useId();
  const body = Str.trim(text);
  const ready = Schema.is(PostText)(body) && viewer._tag === "Success";

  /** Shows the announcement at once, sends it under a new key, and restores the dialog when it fails. */
  const submit = () => {
    if (!ready) {
      return;
    }
    const { person } = viewer.value;
    setOpen(false);
    setText("");
    setEmail(false);
    runForumCall(
      Effect.flatMap(randomUuid, (clientKey) =>
        publishPost(
          (update, args) => publish.withOptimisticUpdate(update)(args),
          { id: person.id, name: person.name },
          { classId, clientKey, email, slug, text: body }
        )
      ),
      () => {
        setText((current) => (current === "" ? body : current));
        setEmail(email);
        setOpen(true);
        toastForumFailure();
      }
    );
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("post-new")}</Button>
      <ResponsiveDialog
        description={t("post-new-description")}
        footer={
          <>
            <Button onClick={() => setOpen(false)} variant="outline">
              {common("cancel")}
            </Button>
            <Button disabled={!ready} onClick={submit}>
              {t("post-submit")}
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
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}
