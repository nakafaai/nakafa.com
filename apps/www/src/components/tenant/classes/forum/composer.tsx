import { useMutation } from "@confect/react";
import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { MessageText } from "@repo/backend/confect/classroom/forum/message";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@repo/design-system/components/ui/input-group";
import { isEnterOutsideComposition } from "@repo/design-system/lib/keyboard";
import { randomUuid } from "@repo/utilities/uuid";
import { Effect, Option, Schema, String as Str } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { runForumCall } from "@/components/tenant/classes/forum/call";
import { useChannelScope } from "@/components/tenant/classes/forum/scope";
import { sendMessage } from "@/components/tenant/classes/forum/send";
import { useViewerQuery } from "@/components/tenant/context";

/** A message the server refused, kept with its key so Try again never posts it twice. */
const Unsent = Schema.Struct({ clientKey: Schema.String, text: Schema.String });

/**
 * The composer of a channel, as Nina's composer looks: one text field and a send button. Enter
 * sends and Shift with Enter starts a new line. A sent message shows in the channel at once with
 * the viewer as its author, and the field empties. A send that fails leaves the message out of the
 * channel, puts its text back in the field, and says so with Try again, which sends it under the
 * same key, so the server stores it once.
 */
export function ForumComposer() {
  const t = useTranslations("Classroom");
  const { channelId, classId, slug } = useChannelScope();
  const send = useMutation(classroom.forum.messages.send);
  const viewer = useViewerQuery();
  const [text, setText] = useState("");
  const [unsent, setUnsent] = useState<Option.Option<typeof Unsent.Type>>(
    Option.none
  );
  const body = Str.trim(text);
  const ready = Schema.is(MessageText)(body) && viewer._tag === "Success";

  /** Sends `message` under `clientKey`, showing it at once, and keeps it when the send fails. */
  const post = (message: string, clientKey: string) => {
    if (viewer._tag !== "Success") {
      return;
    }
    const { person } = viewer.value;
    setText("");
    setUnsent(Option.none());
    runForumCall(
      sendMessage(
        (update, args) => send.withOptimisticUpdate(update)(args),
        { id: person.id, name: person.name },
        { channelId, classId, clientKey, slug, text: message }
      ),
      () => {
        setText((current) => (current === "" ? message : current));
        setUnsent(Option.some({ clientKey, text: message }));
      }
    );
  };

  /** Sends what the field holds under a new key. */
  const submit = () => {
    if (!ready) {
      return;
    }
    runForumCall(
      Effect.map(randomUuid, (clientKey) => post(body, clientKey)),
      () => undefined
    );
  };

  return (
    <form action={submit} className="flex w-full min-w-0 flex-col gap-2">
      {Option.isSome(unsent) ? (
        <div className="flex items-center justify-between gap-2 text-destructive text-sm">
          <span>{t("send-failed")}</span>
          <Button
            onClick={() => post(unsent.value.text, unsent.value.clientKey)}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("send-retry")}
          </Button>
        </div>
      ) : null}
      <InputGroup className="rounded-3xl bg-muted/50 text-chat shadow-none">
        <InputGroupTextarea
          aria-label={t("message-placeholder")}
          className="max-h-[min(12rem,35dvh)] min-h-12 px-3 py-3"
          dir="auto"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (
              isEnterOutsideComposition(event.nativeEvent) &&
              !event.shiftKey
            ) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={t("message-placeholder")}
          value={text}
        />
        <InputGroupAddon
          align="block-end"
          className="justify-end group-has-[>[data-slot=input-group-control]]/input-group:pb-3"
        >
          <InputGroupButton
            aria-label={t("send-message")}
            className="rounded-full"
            disabled={!ready}
            size="icon"
            type="submit"
            variant="default"
          >
            <HugeIcons icon={ArrowUp02Icon} />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
