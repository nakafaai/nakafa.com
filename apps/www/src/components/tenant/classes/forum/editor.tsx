import { useMutation } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { MessageText } from "@repo/backend/confect/classroom/forum/message";
import { Button } from "@repo/design-system/components/ui/button";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Clock, Effect, Schema, String as Str } from "effect";
import { useTranslations } from "use-intl";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import {
  editUpdate,
  type ForumMessage,
} from "@/components/tenant/classes/forum/optimistic";
import { useChannelScope } from "@/components/tenant/classes/forum/scope";

/**
 * The field that edits the viewer's own message in its place. Save shows the new text at once,
 * and a refusal brings the old text back with the toast every School action uses. A text that is
 * unchanged or not a message keeps the message as it was, and so does Escape.
 */
export function MessageEditor({
  message,
  onDone,
  text,
}: {
  message: ForumMessage;
  onDone: () => void;
  text: string;
}) {
  const t = useTranslations("Classroom");
  const scope = useChannelScope();
  const common = useTranslations("Common");
  const edit = useMutation(classroom.forum.messages.edit);

  const save = (draft: FormDataEntryValue | null) => {
    onDone();
    const body = Str.trim(typeof draft === "string" ? draft : "");
    if (!Schema.is(MessageText)(body) || body === text) {
      return;
    }
    runForumCall(
      Effect.flatMap(Clock.currentTimeMillis, (at) =>
        forumCall(() =>
          edit.withOptimisticUpdate(editUpdate(at))({
            classId: scope.classId,
            messageId: message.id,
            slug: scope.slug,
            text: body,
          })
        )
      ),
      toastForumFailure
    );
  };

  return (
    <form
      action={(form) => save(form.get("text"))}
      className="flex w-full min-w-0 flex-col gap-2"
    >
      <Textarea
        aria-label={t("message-edit")}
        autoFocus
        defaultValue={text}
        dir="auto"
        name="text"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onDone();
          }
        }}
        placeholder={t("message-placeholder")}
      />
      <div className="flex justify-end gap-2">
        <Button onClick={onDone} type="button" variant="outline">
          {common("cancel")}
        </Button>
        <Button type="submit" variant="secondary">
          {t("message-save")}
        </Button>
      </div>
    </form>
  );
}
