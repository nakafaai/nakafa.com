import { useMutation } from "@confect/react";
import {
  Add01Icon,
  ArrowUp02Icon,
  ChartBarLineIcon,
  File02Icon,
  Image01Icon,
  SmileIcon,
} from "@hugeicons/core-free-icons";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { MentionView } from "@repo/backend/confect/classroom/forum/mention";
import {
  MessageText,
  MessageView,
} from "@repo/backend/confect/classroom/forum/message";
import type { PollDraft } from "@repo/backend/confect/classroom/forum/poll";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@repo/design-system/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { isEnterOutsideComposition } from "@repo/design-system/lib/keyboard";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, Effect, Option, Schema, String as Str } from "effect";
import { useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { runForumCall } from "@/components/tenant/classes/forum/call";
import { useMentionPicker } from "@/components/tenant/classes/forum/picker";
import { NewPoll } from "@/components/tenant/classes/forum/poll";
import { useChannelScope } from "@/components/tenant/classes/forum/scope";
import { sendMessage, sendReply } from "@/components/tenant/classes/forum/send";
import { EmojiGrid } from "@/components/tenant/classes/forum/tallies";
import {
  DOCUMENT_ACCEPT,
  UploadTray,
  useUploadTray,
} from "@/components/tenant/classes/forum/tray";
import { shownFile } from "@/components/tenant/classes/forum/upload";
import { useViewerQuery } from "@/components/tenant/context";

/** A message the server refused, kept with its key and all it carries so Try again never posts it twice. */
const Unsent = Schema.Struct({
  attachments: MessageView.fields.attachments,
  clientKey: Schema.String,
  mentions: Schema.Array(MentionView),
  text: Schema.String,
  uploads: Schema.Array(Id("classroomUploads")),
});

/** A mention as a send names it: a Person by ID, everyone, or Nina. */
const mentionArg = (mention: typeof MentionView.Type) =>
  mention._tag === "person"
    ? { _tag: "person" as const, id: mention.id }
    : { _tag: mention._tag };

/**
 * The composer of a channel or of a discussion, as a chat's: Add for a photo, a document or a poll, the
 * text field, an emoji and the send button. Enter sends and Shift with Enter starts a new line, and
 * `@` opens the mention list at the caret, whose keys come first while it is open. A file pasted or
 * dropped on the composer joins the tray like a chosen one, and the send waits for the tray. A sent
 * message shows in the channel, or as a reply in the discussion, at once with the viewer as its
 * author, and the field empties. A send that fails leaves the message out, puts its text back in the
 * field, and says so with Try again, which sends it under the same key, so the server stores it once.
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
  const photos = useRef<HTMLInputElement>(null);
  const documents = useRef<HTMLInputElement>(null);
  const picker = useMentionPicker(field, text, setText);
  const tray = useUploadTray();
  const [polling, setPolling] = useState(false);
  const body = Str.trim(text);
  const placeholder = t(
    discussion === undefined ? "message-placeholder" : "reply-placeholder"
  );
  const ready =
    (Schema.is(MessageText)(body) || Arr.isReadonlyArrayNonEmpty(tray.files)) &&
    !tray.uploading &&
    viewer._tag === "Success";

  /** Sends `message` under `clientKey` with all it carries, showing it at once, and keeps it when the send fails. */
  const post = (
    message: string,
    clientKey: string,
    mentions: readonly (typeof MentionView.Type)[],
    carried: Pick<typeof Unsent.Type, "attachments" | "uploads">,
    poll: typeof PollDraft.Type | null
  ) => {
    if (viewer._tag !== "Success") {
      return;
    }
    const { person } = viewer.value;
    const author = { id: person.id, name: person.name, nina: false };
    const named = Arr.map(mentions, mentionArg);
    const shown = { attachments: carried.attachments, mentions };
    setText("");
    setUnsent(Option.none());
    picker.clear();
    tray.clear();
    runForumCall(
      discussion === undefined
        ? sendMessage(
            (update, args) => send.withOptimisticUpdate(update)(args),
            author,
            {
              attachments: carried.uploads,
              channelId,
              classId,
              clientKey,
              mentions: named,
              poll,
              slug,
              text: message,
            },
            shown
          )
        : sendReply(
            (update, args) => reply.withOptimisticUpdate(update)(args),
            author,
            {
              attachments: carried.uploads,
              classId,
              clientKey,
              mentions: named,
              number: discussion,
              slug,
              text: message,
            },
            shown
          ),
      () => {
        setText((current) => (current === "" ? message : current));
        setUnsent(
          Option.some({ ...carried, clientKey, mentions, text: message })
        );
      }
    );
  };

  /** Sends what the field holds under a new key. */
  const submit = () => {
    if (!ready) {
      return;
    }
    const mentions = picker.kept();
    const carried = {
      attachments: Arr.map(tray.files, shownFile),
      uploads: Arr.getSomes(Arr.map(tray.files, (file) => file.upload)),
    };
    runForumCall(
      Effect.map(randomUuid, (clientKey) =>
        post(body, clientKey, mentions, carried, null)
      ),
      () => undefined
    );
  };

  /** Sends a poll on its own, as a message of the channel. */
  const sendPoll = (poll: typeof PollDraft.Type) =>
    runForumCall(
      Effect.map(randomUuid, (clientKey) =>
        post("", clientKey, [], { attachments: [], uploads: [] }, poll)
      ),
      () => undefined
    );

  /** Puts an emoji where the caret stands. */
  const insertEmoji = (emoji: string) => {
    const at = field.current?.selectionStart ?? text.length;
    setText(`${text.slice(0, at)}${emoji}${text.slice(at)}`);
    field.current?.focus();
  };

  return (
    <form action={submit} className="flex w-full min-w-0 flex-col gap-2">
      {Option.isSome(unsent) ? (
        <div className="text-destructive flex items-center justify-between gap-2 text-sm">
          <span>{t("send-failed")}</span>
          <Button
            onClick={() =>
              post(
                unsent.value.text,
                unsent.value.clientKey,
                unsent.value.mentions,
                unsent.value,
                null
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
      <UploadTray files={tray.files} onRemove={tray.remove} />
      <input
        accept="image/*"
        aria-hidden="true"
        className="hidden"
        multiple
        onChange={(event) => {
          tray.add(Arr.fromIterable(event.target.files ?? []));
          event.target.value = "";
        }}
        ref={photos}
        tabIndex={-1}
        type="file"
      />
      <input
        accept={DOCUMENT_ACCEPT}
        aria-hidden="true"
        className="hidden"
        multiple
        onChange={(event) => {
          tray.add(Arr.fromIterable(event.target.files ?? []));
          event.target.value = "";
        }}
        ref={documents}
        tabIndex={-1}
        type="file"
      />
      <InputGroup className="bg-muted/50 text-chat rounded-3xl shadow-none">
        <InputGroupAddon align="inline-start" className="self-end pb-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <InputGroupButton
                  aria-label={t("attach-add")}
                  className="rounded-full"
                  size="icon"
                  title={t("attach-add")}
                  variant="ghost"
                >
                  <HugeIcons icon={Add01Icon} />
                </InputGroupButton>
              }
            />
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={() => photos.current?.click()}>
                <HugeIcons icon={Image01Icon} />
                {t("attach-photo")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => documents.current?.click()}>
                <HugeIcons icon={File02Icon} />
                {t("attach-document")}
              </DropdownMenuItem>
              {discussion === undefined ? (
                <DropdownMenuItem onClick={() => setPolling(true)}>
                  <HugeIcons icon={ChartBarLineIcon} />
                  {t("attach-poll")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </InputGroupAddon>
        <InputGroupTextarea
          {...picker.fieldProps}
          aria-label={placeholder}
          className="max-h-[min(12rem,35dvh)] min-h-11 py-3 ps-1"
          dir="auto"
          onChange={(event) => {
            setText(event.target.value);
            picker.onCaret(event);
          }}
          onClick={picker.onCaret}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const dropped = Arr.fromIterable(event.dataTransfer.files);
            if (Arr.isReadonlyArrayNonEmpty(dropped)) {
              event.preventDefault();
              tray.add(dropped);
            }
          }}
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
          onPaste={(event) => {
            const pasted = Arr.fromIterable(event.clipboardData.files);
            if (Arr.isReadonlyArrayNonEmpty(pasted)) {
              event.preventDefault();
              tray.add(pasted);
            }
          }}
          placeholder={placeholder}
          ref={field}
          value={text}
        />
        {/* The send button stands at the end of the field's last line, as the field grows. */}
        <InputGroupAddon align="inline-end" className="self-end pb-1.5">
          <Popover>
            <PopoverTrigger
              render={
                <InputGroupButton
                  aria-label={t("emoji-open")}
                  className="rounded-full"
                  size="icon"
                  title={t("emoji-open")}
                  variant="ghost"
                >
                  <HugeIcons icon={SmileIcon} />
                </InputGroupButton>
              }
            />
            <PopoverContent align="end" className="w-auto p-2">
              <EmojiGrid onPick={insertEmoji} />
            </PopoverContent>
          </Popover>
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
      <NewPoll onSend={sendPoll} open={polling} setOpen={setPolling} />
    </form>
  );
}
