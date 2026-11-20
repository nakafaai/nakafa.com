import { File02Icon, Image01Icon } from "@hugeicons/core-free-icons";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@repo/design-system/components/ui/attachment";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
} from "@repo/design-system/components/ui/avatar";
import {
  Bubble,
  BubbleContent,
} from "@repo/design-system/components/ui/bubble";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Item,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@repo/design-system/components/ui/message";
import { Nina } from "@repo/design-system/components/ui/nina";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import type { Mascot } from "@repo/mascot/code";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { DEMO_REPLIERS } from "@/components/marketing/school/features/cast";
import { demoTime } from "@/components/marketing/school/features/clock";
import { FileName } from "@/components/marketing/school/features/file";
import { LabGraph } from "@/components/marketing/school/features/graph";
import {
  documentCard,
  reactionChip,
} from "@/components/tenant/classes/forum/chips";

/** Nina's head in a member's round frame, as the forum draws her beside her replies. */
export function NinaFace() {
  return (
    <Avatar aria-hidden="true">
      <AvatarFallback>
        <Nina label="" size={32} />
      </AvatarFallback>
    </Avatar>
  );
}

/** A member's round face beside their messages: their animal, which says nothing to a screen reader. */
export function MemberFace({ mascot }: { mascot: typeof Mascot.Type }) {
  return <PersonAvatar aria-hidden="true" mascot={mascot} />;
}

/**
 * One message of the demo chat, laid out as the School forum lays one out: the face beside the header row, the
 * author's name and the time above the bubble, and under the bubble what the message carries, its reactions and its
 * thread. `minutes` counts from the demo's moment, so the time is the same on the server and in the browser.
 */
export function DemoMessage({
  children,
  face,
  minutes,
  name,
}: {
  children: ReactNode;
  face: ReactNode;
  minutes: number;
  name: string;
}) {
  const locale = useLocale();

  return (
    <Message className="rounded-2xl px-2 py-1">
      <MessageAvatar className="translate-y-0 self-start bg-transparent">
        {face}
      </MessageAvatar>
      <MessageContent>
        <MessageHeader className="flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-foreground font-semibold wrap-anywhere">
            {name}
          </span>
          <time className="font-normal tabular-nums">
            {demoTime(locale, minutes)}
          </time>
        </MessageHeader>
        {children}
      </MessageContent>
    </Message>
  );
}

/** The text of a message on another member's muted bubble. */
export function DemoBubble({ children }: { children: ReactNode }) {
  return (
    <Bubble variant="muted">
      <BubbleContent className="wrap-anywhere">{children}</BubbleContent>
    </Bubble>
  );
}

/**
 * The emoji a message carries, under its bubble, as the forum shows them: each with its count, and a press gives it
 * or takes it back, here as in the class.
 */
export function DemoReactions({
  given,
}: {
  given: readonly { readonly count: number; readonly emoji: string }[];
}) {
  const t = useTranslations("Classroom");
  const [mine, setMine] = useState<readonly string[]>([]);

  return (
    <div className="flex flex-wrap gap-1 px-1" data-reactions="">
      {Arr.map(given, ({ count, emoji }) => {
        const pressed = Arr.contains(mine, emoji);
        const shown = pressed ? count + 1 : count;
        return (
          <Button
            aria-label={t("reaction-label", { count: shown, emoji })}
            aria-pressed={pressed}
            className={reactionChip({ mine: pressed })}
            key={emoji}
            onClick={() =>
              setMine((current) =>
                pressed
                  ? Arr.filter(current, (each) => each !== emoji)
                  : Arr.append(current, emoji)
              )
            }
            type="button"
            variant="outline"
          >
            <span>{emoji}</span>
            {shown}
          </Button>
        );
      })}
    </div>
  );
}

/** The thread under a message, as the forum sums a discussion up: the faces of who answered, how many, and when last. */
export function DemoThread({
  minutes,
  replies,
}: {
  minutes: number;
  replies: number;
}) {
  const t = useTranslations("Classroom");
  const tCommon = useTranslations("Common");
  const locale = useLocale();

  return (
    <Item
      className="bg-background w-fit max-w-full flex-nowrap"
      size="xs"
      variant="outline"
    >
      <ItemMedia>
        <AvatarGroup>
          {Arr.map(Arr.take(DEMO_REPLIERS, replies), (mascot) => (
            <PersonAvatar
              aria-hidden="true"
              key={mascot.animal}
              mascot={mascot}
              size="sm"
            />
          ))}
        </AvatarGroup>
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-semibold">
            {tCommon("replies", { count: replies })}
          </span>
          <span className="text-muted-foreground text-xs font-normal">
            {t("thread-last", { time: demoTime(locale, minutes) })}
          </span>
        </ItemTitle>
      </ItemContent>
    </Item>
  );
}

/** The worksheet the teacher attached, as the forum draws a document: its icon, its name and its size. */
export function DemoWorksheet() {
  const t = useTranslations("SchoolSite");
  const format = useFormatter();

  return (
    <Attachment className={documentCard()}>
      <AttachmentMedia variant="icon">
        <HugeIcons icon={File02Icon} />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{t("demo-library-worksheet")}</AttachmentTitle>
        <AttachmentDescription>
          {format.number(240, "kilobyte")}
        </AttachmentDescription>
      </AttachmentContent>
    </Attachment>
  );
}

/** The graph a lab group shares, as the forum draws a picture: the picture itself, then its name under it. */
export function DemoFigure() {
  const t = useTranslations("SchoolSite");

  return (
    <figure className="bg-muted/50 ring-foreground/10 grid w-72 max-w-full overflow-hidden rounded-xl ring-1">
      <div className="aspect-8/5">
        <LabGraph />
      </div>
      <figcaption className="flex min-w-0 items-center gap-2 px-3 py-2 text-sm">
        <HugeIcons className="text-muted-foreground" icon={Image01Icon} />
        <FileName name={t("demo-library-graph")} />
      </figcaption>
    </figure>
  );
}

/** Nina writing, as the chat shows a member at work on a reply: her face and three dots on her bubble. */
export function DemoTyping() {
  const t = useTranslations("SchoolSite");

  return (
    <Message className="rounded-2xl px-2 py-1">
      <MessageAvatar className="translate-y-0 self-start bg-transparent">
        <NinaFace />
      </MessageAvatar>
      <MessageContent>
        <Bubble variant="muted">
          <BubbleContent
            aria-label={t("demo-forum-typing")}
            className="flex h-5 items-center gap-1"
          >
            {Arr.map([0, 1, 2], (dot) => (
              <span
                className="bg-muted-foreground size-1.5 rounded-full"
                data-dot={dot}
                key={dot}
              />
            ))}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}
