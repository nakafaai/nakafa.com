import { useInViewport, useMergedRef, useReducedMotion } from "@mantine/hooks";
import {
  Bubble,
  BubbleContent,
} from "@repo/design-system/components/ui/bubble";
import {
  Message,
  MessageContent,
  MessageGroup,
} from "@repo/design-system/components/ui/message";
import { Array as Arr, Match } from "effect";
import { type AnimationSequence, animate } from "motion";
import { useEffect, useRef } from "react";
import { useTranslations } from "use-intl";
import {
  DEMO_ASKER,
  DEMO_TEACHER,
} from "@/components/marketing/school/features/cast";
import { useRoom } from "@/components/marketing/school/features/scope";
import {
  DemoBubble,
  DemoFigure,
  DemoMessage,
  DemoReactions,
  DemoThread,
  DemoTyping,
  DemoWorksheet,
  MemberFace,
  NinaFace,
} from "@/components/marketing/school/features/talk";

/** A message lands with a small rise, as a chat app sets a new one down. */
const LAND = [0.23, 1, 0.32, 1] as const;

/**
 * The story of Nina's reply, played once when the chat comes into view: her bubble steps aside for three dots that
 * breathe while she writes, then her reply lands where the dots stood and its hearts follow.
 */
function composeArrival(chat: HTMLElement): AnimationSequence {
  const all = (selector: string) => chat.querySelectorAll(selector);

  return [
    [all("[data-arrive]"), { opacity: 0, y: 8 }, { at: 0, duration: 0.01 }],
    [all("[data-typing]"), { opacity: 1 }, { at: 0.3, duration: 0.2 }],
    ...Arr.map([0, 1, 2], (dot): AnimationSequence[number] => [
      all(`[data-dot="${dot}"]`),
      { opacity: [0.35, 1, 0.35, 1, 0.35] },
      { at: 0.4 + dot * 0.15, duration: 1.2 },
    ]),
    [all("[data-typing]"), { opacity: 0 }, { at: 1.9, duration: 0.15 }],
    [
      all("[data-arrive]"),
      { opacity: 1, y: 0 },
      { at: 1.95, duration: 0.4, ease: LAND },
    ],
    [
      all("[data-arrive] [data-reactions]"),
      { opacity: [0, 1], scale: [0.9, 1] },
      { at: 2.3, duration: 0.25, ease: LAND },
    ],
  ];
}

/**
 * Plays Nina's reply once, the first time the chat is in view, and never for a reader who asked for less motion; the
 * chat is whole in the first HTML. Leaving the view ends the story where it would stop.
 */
function useArrival() {
  const chat = useRef<HTMLDivElement>(null);
  const played = useRef(false);
  const { inViewport, ref: seen } = useInViewport<HTMLDivElement>();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const element = chat.current;
    if (
      element === null ||
      !inViewport ||
      shouldReduceMotion ||
      played.current
    ) {
      return;
    }
    played.current = true;
    const controls = animate(composeArrival(element));
    return () => controls.complete();
  }, [inViewport, shouldReduceMotion]);

  return useMergedRef(chat, seen);
}

/** The momentum chat: a student asks, the teacher answers with the worksheet and a thread, and Nina adds her summary. */
function MomentumChat() {
  const t = useTranslations("SchoolSite");
  const tClass = useTranslations("Classroom");
  const arrival = useArrival();

  return (
    <MessageGroup className="gap-4" ref={arrival}>
      <DemoMessage
        face={<MemberFace mascot={DEMO_ASKER.mascot} />}
        minutes={0}
        name={DEMO_ASKER.name}
      >
        <DemoBubble>{t("demo-forum-ask")}</DemoBubble>
        <DemoReactions given={[{ count: 3, emoji: "🙋" }]} />
      </DemoMessage>
      <DemoMessage
        face={<MemberFace mascot={DEMO_TEACHER.mascot} />}
        minutes={3}
        name={t("demo-teacher")}
      >
        <DemoBubble>
          <bdi className="font-semibold">@{DEMO_ASKER.name}</bdi>{" "}
          {t("demo-forum-answer")}
        </DemoBubble>
        <DemoWorksheet />
        <DemoReactions
          given={[
            { count: 4, emoji: "👍" },
            { count: 2, emoji: "🙏" },
          ]}
        />
        <DemoThread minutes={10} replies={3} />
      </DemoMessage>
      <div className="grid">
        <div className="col-start-1 row-start-1" data-arrive="">
          <DemoMessage
            face={<NinaFace />}
            minutes={4}
            name={tClass("nina-author")}
          >
            <DemoBubble>{t("demo-forum-nina")}</DemoBubble>
            <DemoReactions given={[{ count: 5, emoji: "❤️" }]} />
          </DemoMessage>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none col-start-1 row-start-1 opacity-0"
          data-typing=""
        >
          <DemoTyping />
        </div>
      </div>
    </MessageGroup>
  );
}

/** The general chat: the teacher's note to the whole class, which the class thanks with its thumbs. */
function GeneralChat() {
  const t = useTranslations("SchoolSite");

  return (
    <MessageGroup className="gap-4">
      <DemoMessage
        face={<MemberFace mascot={DEMO_TEACHER.mascot} />}
        minutes={-142}
        name={t("demo-teacher")}
      >
        <DemoBubble>{t("demo-forum-general")}</DemoBubble>
        <DemoReactions
          given={[
            { count: 12, emoji: "👍" },
            { count: 3, emoji: "📓" },
          ]}
        />
      </DemoMessage>
    </MessageGroup>
  );
}

/** The lab chat: a group shares the graph of its run, and two classmates answer in its thread. */
function LabChat() {
  const t = useTranslations("SchoolSite");

  return (
    <MessageGroup className="gap-4">
      <DemoMessage
        face={<MemberFace mascot={DEMO_ASKER.mascot} />}
        minutes={-47}
        name={DEMO_ASKER.name}
      >
        <DemoBubble>{t("demo-forum-lab")}</DemoBubble>
        <DemoFigure />
        <DemoReactions given={[{ count: 6, emoji: "🔥" }]} />
        <DemoThread minutes={-31} replies={2} />
      </DemoMessage>
    </MessageGroup>
  );
}

/** What the reader posted into the open chat, on the forum's own-message bubble at the end of the row. */
function PostedMessages() {
  const channel = useRoom((state) => state.channel);
  const posted = useRoom((state) => state.posted);
  const mine = Arr.filter(posted, (message) => message.channel === channel);

  if (Arr.isReadonlyArrayEmpty(mine)) {
    return null;
  }
  return (
    <MessageGroup className="gap-3">
      {Arr.map(mine, (message) => (
        <Message align="end" key={message.key}>
          <MessageContent>
            <Bubble align="end" variant="secondary">
              <BubbleContent className="wrap-anywhere" dir="auto">
                {message.text}
              </BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      ))}
    </MessageGroup>
  );
}

/**
 * The messages of the open chat, newest at the bottom as a chat app opens one: the column scrolls from its end, so
 * what the reader posts stays in view.
 */
export function ChannelTalk() {
  const channel = useRoom((state) => state.channel);

  return (
    <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain px-2 py-4 sm:px-4">
      <div className="grid gap-4">
        {Match.value(channel).pipe(
          Match.when("general", () => <GeneralChat />),
          Match.when("momentum", () => <MomentumChat />),
          Match.when("lab", () => <LabChat />),
          Match.exhaustive
        )}
        <PostedMessages />
      </div>
    </div>
  );
}
