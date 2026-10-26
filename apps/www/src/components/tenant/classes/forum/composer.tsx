import { useMutation } from "@confect/react";
import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { MentionView } from "@repo/backend/confect/classroom/forum/mention";
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
import { Array as Arr, Effect, Option, Schema, String as Str } from "effect";
import { useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { runForumCall } from "@/components/tenant/classes/forum/call";
import { useMentionPicker } from "@/components/tenant/classes/forum/picker";
import { useChannelScope } from "@/components/tenant/classes/forum/scope";
import { sendMessage, sendReply } from "@/components/tenant/classes/forum/send";
import { useViewerQuery } from "@/components/tenant/context";

/** A message the server refused, kept with its key and its mentions so Try again never posts it twice. */
const Unsent = Schema.Struct({
  clientKey: Schema.String,
  mentions: Schema.Array(MentionView),
  text: Schema.String,
});

/** A mention as a send names it: a Person by ID, or everyone. */
const mentionArg = (mention: typeof MentionView.Type) =>
  mention._tag === "everyone"
    ? { _tag: "everyone" as const }
    : { _tag: "person" as const, id: mention.id };

/**
 * The composer of a channel or of a discussion, as Nina's composer looks: one text field and a send
 * button. Enter sends and Shift with Enter starts a new line, and `@` opens the mention list at the
 * caret, whose keys come first while it is open. A sent message shows in the channel,
 * or as a reply in the discussion, at once with the viewer as its author, and the field empties. A
 * send that fails leaves the message out, puts its text back in the field, and says so with Try
 * again, which sends it under the same key, so the server stores it once.
 */
export function ForumComposer() {
  const t = useTranslations("Classroom");
  const { channelId, classId, discussion, slug } = useChannelScope();
  const send = useMutation(classroom.forum.messages.send);
  const reply = useMutation(classroom.forum.threads.reply);
  const viewer = useViewerQuery();
  const [text, setText] = useState("");
  const [unsent, setUnsent] = useState<Option.Option<typeof Unsent.Type>>(
    Option.none
  );
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useMentionPicker(field, text, setText);
  const body = Str.trim(text);
  const placeholder = t(
    discussion === undefined ? "message-placeholder" : "reply-placeholder"
  );
  const ready = Schema.is(MessageText)(body) && viewer._tag === "Success";

  /** Sends `message` under `clientKey` with its mentions, showing it at once, and keeps it when the send fails. */
  const post = (
    message: string,
    clientKey: string,
    mentions: readonly (typeof MentionView.Type)[]
  ) => {
    if (viewer._tag !== "Success") {
      return;
    }
    const { person } = viewer.value;
    const author = { id: person.id, name: person.name };
    const named = Arr.map(mentions, mentionArg);
    setText("");
    setUnsent(Option.none());
    picker.clear();
    runForumCall(
      discussion === undefined
        ? sendMessage(
            (update, args) => send.withOptimisticUpdate(update)(args),
            author,
            {
              channelId,
              classId,
              clientKey,
              mentions: named,
              slug,
              text: message,
            },
            mentions
          )
        : sendReply(
            (update, args) => reply.withOptimisticUpdate(update)(args),
            author,
            {
              classId,
              clientKey,
              mentions: named,
              number: discussion,
              slug,
              text: message,
            },
            mentions
          ),
      () => {
        setText((current) => (current === "" ? message : current));
        setUnsent(Option.some({ clientKey, mentions, text: message }));
      }
    );
  };

  /** Sends what the field holds under a new key. */
  const submit = () => {
    if (!ready) {
      return;
    }
    const mentions = picker.kept();
    runForumCall(
      Effect.map(randomUuid, (clientKey) => post(body, clientKey, mentions)),
      () => undefined
    );
  };

  return (
    <form action={submit} className="flex w-full min-w-0 flex-col gap-2">
      {Option.isSome(unsent) ? (
        <div className="flex items-center justify-between gap-2 text-destructive text-sm">
          <span>{t("send-failed")}</span>
          <Button
            onClick={() =>
              post(
                unsent.value.text,
                unsent.value.clientKey,
                unsent.value.mentions
              )
            }
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
          {...picker.fieldProps}
          aria-label={placeholder}
          className="max-h-[min(12rem,35dvh)] min-h-12 px-3 py-3"
          dir="auto"
          onChange={(event) => {
            setText(event.target.value);
            picker.onCaret(event);
          }}
          onClick={picker.onCaret}
          onKeyDown={(event) => {
            if (picker.onKeyDown(event)) {
              return;
            }
            if (
              isEnterOutsideComposition(event.nativeEvent) &&
              !event.shiftKey
            ) {
              event.preventDefault();
              submit();
            }
          }}
          onKeyUp={picker.onCaret}
          placeholder={placeholder}
          ref={field}
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
      {picker.popup}
    </form>
  );
}
