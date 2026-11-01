import { useMutation } from "@confect/react";
import {
  Add01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import {
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  PollOption,
  PollQuestion,
} from "@repo/backend/confect/classroom/forum/poll";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Switch } from "@repo/design-system/components/ui/switch";
import { cva } from "class-variance-authority";
import {
  Array as Arr,
  Number as Num,
  Option,
  Schema,
  String as Str,
} from "effect";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import type { ForumMessage } from "@/components/tenant/classes/forum/optimistic";
import { useChannelScope } from "@/components/tenant/classes/forum/scope";
import { useTally } from "@/components/tenant/classes/forum/tallies";
import {
  type ForumTally,
  shareOf,
  voteUpdate,
} from "@/components/tenant/classes/forum/tally";

/** One choice while the poll is written: its text, and an ID that keeps its field as others leave. */
const PollChoice = Schema.Struct({ id: Schema.Int, text: Schema.String });

/** The two choices every poll starts with. */
const FIRST_CHOICES: readonly (typeof PollChoice.Type)[] = [
  { id: 0, text: "" },
  { id: 1, text: "" },
];

/** The poll a message carries. */
type ForumPoll = NonNullable<ForumMessage["poll"]>;

/** One choice of a poll, marked when the viewer took it. */
const pollChoice = cva(
  "relative flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-xl border px-3 py-2 text-start text-sm disabled:cursor-default",
  { variants: { mine: { false: "", true: "border-primary" } } }
);

/**
 * A message's poll, as WhatsApp shows one (`PollCard`). A leader who reads the class sees the votes and takes none.
 */
export function MessagePoll({ message }: { message: ForumMessage }) {
  const { canPost, classId, slug } = useChannelScope();
  const tally = useTally(message.id);
  const vote = useMutation(classroom.forum.tallies.vote);

  if (message.poll === null) {
    return null;
  }
  return (
    <PollCard
      disabled={!canPost}
      onChoose={(options) =>
        runForumCall(
          forumCall(() =>
            vote.withOptimisticUpdate(voteUpdate)({
              classId,
              messageId: message.id,
              options,
              slug,
            })
          ),
          toastForumFailure
        )
      }
      poll={message.poll}
      votes={Option.match(tally, {
        onNone: () => [],
        onSome: (found) => found.votes,
      })}
    />
  );
}

/**
 * A poll: its question, and its choices with their share of the votes. A press takes a choice and hands the viewer's
 * new choices on, a second press takes it back, and a poll of several choices keeps the others.
 */
export function PollCard({
  disabled,
  onChoose,
  poll,
  votes,
}: {
  disabled: boolean;
  onChoose: (options: readonly number[]) => void;
  poll: ForumPoll;
  votes: ForumTally["votes"];
}) {
  const t = useTranslations("Classroom");
  const total = Arr.reduce(votes, 0, (sum, row) => sum + row.count);
  const mine = Arr.map(
    Arr.filter(votes, (row) => row.mine),
    (row) => row.option
  );

  /** The viewer's choices after a press on one option. */
  const pressed = (option: number) => {
    if (Arr.contains(mine, option)) {
      return Arr.filter(mine, (held) => held !== option);
    }
    return poll.multiple ? Arr.append(mine, option) : [option];
  };

  return (
    <div className="bg-muted/40 flex w-full max-w-sm flex-col gap-2 rounded-3xl border p-3">
      <p className="font-semibold wrap-anywhere" dir="auto">
        {poll.question}
      </p>
      <p className="text-muted-foreground text-xs">
        {t(poll.multiple ? "poll-choose-many" : "poll-choose-one")}
      </p>
      {Arr.map(poll.options, (option, index) => {
        const count = Option.match(
          Arr.findFirst(votes, (row) => row.option === index),
          { onNone: () => 0, onSome: (row) => row.count }
        );
        const chosen = Arr.contains(mine, index);
        const share = shareOf(count, total);

        return (
          <button
            aria-pressed={chosen}
            className={pollChoice({ mine: chosen })}
            disabled={disabled}
            key={option}
            onClick={() => onChoose(pressed(index))}
            type="button"
          >
            <span
              aria-hidden="true"
              className="bg-primary/10 absolute inset-y-0 start-0 transition-[width] motion-reduce:transition-none"
              style={{ width: `${share}%` }}
            />
            <span
              className="relative flex min-w-0 items-center gap-2 wrap-anywhere"
              dir="auto"
            >
              {chosen ? (
                <HugeIcons
                  className="text-primary size-4"
                  icon={CheckmarkCircle02Icon}
                />
              ) : null}
              {option}
            </span>
            <span className="text-muted-foreground relative shrink-0 text-xs tabular-nums">
              {share}%
            </span>
          </button>
        );
      })}
      <p className="text-muted-foreground text-xs tabular-nums">
        {t("poll-votes", { count: total })}
      </p>
    </div>
  );
}

/**
 * Writes a poll: its question, two to ten choices, and whether a voter may take several. Send
 * closes the dialog and the poll shows in the chat at once.
 */
export function NewPoll({
  onSend,
  open,
  setOpen,
}: {
  onSend: (poll: ForumPoll) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const id = useId();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(FIRST_CHOICES);
  const [multiple, setMultiple] = useState(false);
  const asked = Str.trim(question);
  const offered = Arr.dedupe(
    Arr.filter(
      Arr.map(options, (option) => Str.trim(option.text)),
      Str.isNonEmpty
    )
  );
  const ready =
    Schema.is(PollQuestion)(asked) &&
    offered.length >= POLL_MIN_OPTIONS &&
    Arr.every(offered, Schema.is(PollOption));

  /** Sends the poll and empties the dialog for the next one. */
  const send = () => {
    if (!ready) {
      return;
    }
    setOpen(false);
    onSend({ multiple, options: offered, question: asked });
    setQuestion("");
    setOptions(FIRST_CHOICES);
    setMultiple(false);
  };

  return (
    <ResponsiveDialog
      description={t("poll-description")}
      footer={
        <>
          <Button onClick={() => setOpen(false)} variant="outline">
            {common("cancel")}
          </Button>
          <Button disabled={!ready} onClick={send}>
            {t("poll-send")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("poll-title")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-question`}>
            {t("poll-question")}
          </FieldLabel>
          <Input
            id={`${id}-question`}
            maxLength={200}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t("poll-question-placeholder")}
            value={question}
          />
        </Field>
        <Field>
          <FieldLabel>{t("poll-options")}</FieldLabel>
          {Arr.map(options, (option, index) => (
            <div className="flex items-center gap-2" key={option.id}>
              <Input
                aria-label={t("poll-option", { number: index + 1 })}
                maxLength={100}
                onChange={(event) =>
                  setOptions(
                    Arr.map(options, (held) =>
                      held.id === option.id
                        ? { ...held, text: event.target.value }
                        : held
                    )
                  )
                }
                placeholder={t("poll-option", { number: index + 1 })}
                value={option.text}
              />
              {options.length > POLL_MIN_OPTIONS ? (
                <Button
                  aria-label={t("poll-remove-option", { number: index + 1 })}
                  onClick={() =>
                    setOptions(
                      Arr.filter(options, (held) => held.id !== option.id)
                    )
                  }
                  size="icon"
                  title={t("poll-remove-option", { number: index + 1 })}
                  type="button"
                  variant="ghost"
                >
                  <HugeIcons icon={Cancel01Icon} />
                </Button>
              ) : null}
            </div>
          ))}
          {options.length < POLL_MAX_OPTIONS ? (
            <Button
              className="w-fit"
              onClick={() =>
                setOptions(
                  Arr.append(options, {
                    id: Arr.reduce(options, 0, (top, option) =>
                      Num.max(top, option.id + 1)
                    ),
                    text: "",
                  })
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              <HugeIcons icon={Add01Icon} />
              {t("poll-add-option")}
            </Button>
          ) : null}
        </Field>
        <Field className="flex-row items-center justify-between gap-4">
          <FieldLabel htmlFor={`${id}-multiple`}>
            {t("poll-multiple")}
          </FieldLabel>
          <Switch
            checked={multiple}
            id={`${id}-multiple`}
            onCheckedChange={setMultiple}
          />
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
