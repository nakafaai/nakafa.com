import { File02Icon, MessageMultiple01Icon } from "@hugeicons/core-free-icons";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@repo/design-system/components/ui/attachment";
import { AvatarGroup } from "@repo/design-system/components/ui/avatar";
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
  MessageGroup,
  MessageHeader,
} from "@repo/design-system/components/ui/message";
import { Nina } from "@repo/design-system/components/ui/nina";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { Array as Arr } from "effect";
import { type ReactNode, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import {
  DEMO_ASKER,
  DEMO_REPLIERS,
  DEMO_TEACHER,
} from "@/components/marketing/school/features/cast";
import { ForumChat } from "@/components/marketing/school/features/chat";
import { demoTime } from "@/components/marketing/school/features/clock";
import { stepVariants } from "@/components/marketing/school/features/step";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import { FeatureCard, FeatureRow } from "@/components/marketing/shared/feature";
import {
  documentCard,
  reactionChip,
} from "@/components/tenant/classes/forum/chips";

/** One message of the class forum: the author's face beside it, their name and time above the bubble, as the forum draws a message. */
function ForumMessage({
  avatar,
  children,
  name,
  step,
  time,
}: {
  avatar: ReactNode;
  children: ReactNode;
  name: string;
  step: 1 | 2 | 3;
  time: string;
}) {
  return (
    <Message className={stepVariants({ step })}>
      <MessageAvatar>{avatar}</MessageAvatar>
      <MessageContent>
        <MessageHeader className="gap-2">
          <span className="text-foreground">{name}</span>
          <time>{time}</time>
        </MessageHeader>
        {children}
      </MessageContent>
    </Message>
  );
}

/**
 * The emoji a message carries, under its bubble, as the forum shows them: each with its count, and a
 * press gives it or takes it back, here as in the class.
 */
function Reactions({
  given,
}: {
  given: readonly { readonly count: number; readonly emoji: string }[];
}) {
  const t = useTranslations("Classroom");
  const [mine, setMine] = useState<readonly string[]>([]);

  return (
    <div className="flex flex-wrap gap-1 px-1">
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

/** The thread under the teacher's answer: who replied and how many, as the forum sums a discussion up. */
function ThreadSummary() {
  const t = useTranslations("SchoolSite");
  const locale = useLocale();

  return (
    <Item
      className="bg-background w-fit max-w-full"
      size="xs"
      variant="outline"
    >
      <ItemMedia>
        <AvatarGroup>
          {Arr.map(DEMO_REPLIERS, (mascot) => (
            <PersonAvatar key={mascot.animal} mascot={mascot} size="sm" />
          ))}
        </AvatarGroup>
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-semibold">
            {t("demo-forum-replies", { count: DEMO_REPLIERS.length })}
          </span>
          <span className="text-muted-foreground text-xs font-normal">
            {demoTime(locale, 10)}
          </span>
        </ItemTitle>
      </ItemContent>
    </Item>
  );
}

/** The worksheet the teacher attached, as the forum draws a document: its icon, its name and its size. */
function Worksheet() {
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
          {format.number(240, { style: "unit", unit: "kilobyte" })}
        </AttachmentDescription>
      </AttachmentContent>
    </Attachment>
  );
}

/**
 * The forum part: a class's chat as the School forum draws it. A student asks, the teacher answers
 * with a mention and the worksheet, the thread its replies hang under, and emoji with their counts;
 * Nina adds what helps in the same muted bubble, and the composer at the bottom posts a message of the
 * reader's own into the chat.
 */
export function SchoolForum() {
  const t = useTranslations("SchoolSite");
  const locale = useLocale();

  return (
    <FeatureRow id="forum">
      <SchoolFeatureText feature="forum">
        <Nina act="typing" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureCard>
        <div className="flex items-center justify-between gap-4">
          <p className="flex min-w-0 items-center gap-2 font-medium">
            <HugeIcons className="size-4" icon={MessageMultiple01Icon} />
            <span className="truncate">{t("demo-class")}</span>
          </p>
          <AvatarGroup>
            <PersonAvatar mascot={DEMO_TEACHER.mascot} size="sm" />
            <PersonAvatar mascot={DEMO_ASKER.mascot} size="sm" />
            {Arr.map(DEMO_REPLIERS, (mascot) => (
              <PersonAvatar key={mascot.animal} mascot={mascot} size="sm" />
            ))}
          </AvatarGroup>
        </div>
        <MessageGroup className="gap-5">
          <ForumMessage
            avatar={<PersonAvatar mascot={DEMO_ASKER.mascot} />}
            name={DEMO_ASKER.name}
            step={1}
            time={demoTime(locale, 0)}
          >
            <Bubble variant="muted">
              <BubbleContent>{t("demo-forum-ask")}</BubbleContent>
            </Bubble>
            <Reactions given={[{ count: 3, emoji: "🙋" }]} />
          </ForumMessage>
          <ForumMessage
            avatar={<PersonAvatar mascot={DEMO_TEACHER.mascot} />}
            name={t("demo-teacher")}
            step={2}
            time={demoTime(locale, 3)}
          >
            <Bubble variant="muted">
              <BubbleContent>
                <strong>@{DEMO_ASKER.name}</strong> {t("demo-forum-answer")}
              </BubbleContent>
            </Bubble>
            <Worksheet />
            <Reactions
              given={[
                { count: 4, emoji: "👍" },
                { count: 2, emoji: "🙏" },
              ]}
            />
            <ThreadSummary />
          </ForumMessage>
          <ForumMessage
            avatar={<Nina label="" lean="center" size={32} tile="cream" />}
            name="Nina"
            step={3}
            time={demoTime(locale, 4)}
          >
            <Bubble variant="muted">
              <BubbleContent>{t("demo-forum-nina")}</BubbleContent>
            </Bubble>
            <Reactions given={[{ count: 5, emoji: "❤️" }]} />
          </ForumMessage>
        </MessageGroup>
        <ForumChat />
      </FeatureCard>
    </FeatureRow>
  );
}
