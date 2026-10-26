import { QueryResult, useQuery } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { MentionView } from "@repo/backend/confect/classroom/forum/mention";
import {
  MentionOption,
  MentionPopup,
} from "@repo/design-system/components/ui/mention";
import { isEnterOutsideComposition } from "@repo/design-system/lib/keyboard";
import { Array as Arr, Number as Num, Option } from "effect";
import {
  type KeyboardEvent,
  type RefObject,
  type SyntheticEvent,
  useId,
  useLayoutEffect,
  useState,
} from "react";
import { useTranslations } from "use-intl";
import { caretRect } from "@/components/tenant/classes/forum/caret";
import {
  insertMention,
  keptMentions,
  matchPeople,
  mentionQuery,
} from "@/components/tenant/classes/forum/mentions";
import { useChannelScope } from "@/components/tenant/classes/forum/scope";

/** A mention the writer picked, as a message shows it. */
type Picked = typeof MentionView.Type;

/** The word a mention of everyone carries in the text. */
const EVERYONE = "everyone";

/**
 * The mention picker of a composer, as WhatsApp's works (ADR 0025): typing `@` opens a list at the
 * caret of the Persons who write in the class, `everyone` first for a subject teacher, and the
 * letters typed after `@` narrow it. The arrow keys move the active choice, Enter or Tab picks it,
 * and Escape closes the list, while the field keeps the focus and the caret. A pick replaces the
 * typed mention with the name. The message sends the picked mentions that its text still holds.
 */
export function useMentionPicker(
  field: RefObject<HTMLTextAreaElement | null>,
  text: string,
  setText: (text: string) => void
) {
  const t = useTranslations("Classroom");
  const { classId, everyone, slug } = useChannelScope();
  const people = useQuery(classroom.forum.people.list, { classId, slug });
  const [caret, setCaret] = useState(0);
  const [picked, setPicked] = useState<readonly Picked[]>([]);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [placed, setPlaced] = useState<number | null>(null);
  const listId = useId();

  // A pick moves the caret after the inserted name once the field shows the new text.
  useLayoutEffect(() => {
    if (placed === null || field.current === null) {
      return;
    }
    field.current.setSelectionRange(placed, placed);
    setPlaced(null);
  }, [field, placed]);

  const typed = mentionQuery(text, caret);
  const choices: readonly Picked[] = Option.match(typed, {
    onNone: () => [],
    onSome: ({ query }) =>
      Arr.appendAll(
        everyone && EVERYONE.startsWith(query.toLowerCase())
          ? [{ _tag: "everyone" as const }]
          : [],
        Arr.map(
          matchPeople(QueryResult.isSuccess(people) ? people.value : [], query),
          (person) => ({ _tag: "person" as const, ...person })
        )
      ),
  });
  const open =
    Option.isSome(typed) &&
    choices.length > 0 &&
    dismissed !== typed.value.start;
  const index = Num.clamp(active, { maximum: choices.length - 1, minimum: 0 });

  /** Replaces the typed mention with the chosen name, and keeps the choice for the send. */
  const pick = (choice: Picked) => {
    if (Option.isNone(typed)) {
      return;
    }
    const next = insertMention(
      text,
      typed.value.start,
      caret,
      choice._tag === "everyone" ? EVERYONE : choice.name
    );
    setText(next.text);
    setCaret(next.caret);
    setPlaced(next.caret);
    setPicked((current) => Arr.append(current, choice));
    setActive(0);
  };

  /** Moves or picks the active choice while the list is open, and answers whether it took the key. */
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) {
      return false;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : choices.length - 1;
      setActive((index + step) % choices.length);
      return true;
    }
    if (
      event.key === "Tab" ||
      (event.key === "Enter" && isEnterOutsideComposition(event.nativeEvent))
    ) {
      event.preventDefault();
      Option.map(Arr.get(choices, index), pick);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDismissed(typed.value.start);
      return true;
    }
    return false;
  };

  // The list stands at the caret's column and above the field's top edge, so it never covers a
  // line the member is writing, whichever line the caret is on.
  const anchor =
    open && field.current !== null
      ? {
          contextElement: field.current,
          getBoundingClientRect: () => {
            if (field.current === null) {
              return new DOMRect();
            }
            const caret = caretRect(field.current, typed.value.start);
            const box = field.current.getBoundingClientRect();
            return new DOMRect(
              caret.x,
              box.top,
              caret.width,
              caret.bottom - box.top
            );
          },
        }
      : null;

  return {
    /** Forgets the picked mentions once a message is sent. */
    clear: () => setPicked([]),
    /** The field's part of the list: the active choice and whether the list is open. */
    fieldProps: {
      "aria-activedescendant": open ? `${listId}-${index}` : undefined,
      "aria-autocomplete": "list" as const,
      "aria-controls": open ? listId : undefined,
      "aria-expanded": open,
    },
    /** The mentions the message sends, and how the message shows them. */
    kept: () => keptMentions(text, picked),
    /** Follows the caret of the field. */
    onCaret: (event: SyntheticEvent<HTMLTextAreaElement>) =>
      setCaret(event.currentTarget.selectionStart),
    onKeyDown,
    popup: (
      <MentionPopup
        anchor={anchor}
        id={listId}
        label={t("mention-list")}
        onClose={() => Option.map(typed, ({ start }) => setDismissed(start))}
        open={open}
      >
        {Arr.map(choices, (choice, position) => (
          <MentionOption
            active={position === index}
            dir="auto"
            id={`${listId}-${position}`}
            key={choice._tag === "everyone" ? EVERYONE : choice.id}
            onPick={() => pick(choice)}
          >
            {choice._tag === "everyone" ? t("mention-everyone") : choice.name}
          </MentionOption>
        ))}
      </MentionPopup>
    ),
  };
}
