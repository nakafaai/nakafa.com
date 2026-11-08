import {
  MessageMultiple01Icon,
  ThumbsUpIcon,
} from "@hugeicons/core-free-icons";
import { AvatarGroup } from "@repo/design-system/components/ui/avatar";
import {
  Bubble,
  BubbleContent,
} from "@repo/design-system/components/ui/bubble";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "@repo/design-system/components/ui/message";
import { Nina } from "@repo/design-system/components/ui/nina";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "use-intl";
import {
  DEMO_ASKER,
  DEMO_REPLIERS,
  DEMO_TEACHER,
} from "@/components/marketing/school/features/cast";
import { demoTime } from "@/components/marketing/school/features/clock";
import { stepVariants } from "@/components/marketing/school/features/step";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import { FeatureCard, FeatureRow } from "@/components/marketing/shared/feature";

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
 * The forum row: a class's chat as the School forum draws it. A student asks,
 * the teacher answers with the thread its replies hang under, and Nina adds
 * what helps, in the same class.
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
          </ForumMessage>
          <ForumMessage
            avatar={<PersonAvatar mascot={DEMO_TEACHER.mascot} />}
            name={t("demo-teacher")}
            step={2}
            time={demoTime(locale, 3)}
          >
            <Bubble variant="muted">
              <BubbleContent>{t("demo-forum-answer")}</BubbleContent>
            </Bubble>
            <MessageFooter className="gap-3">
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 tabular-nums">
                <HugeIcons className="size-3" icon={ThumbsUpIcon} />4
              </span>
              <span className="inline-flex items-center gap-2">
                <AvatarGroup>
                  {Arr.map(DEMO_REPLIERS, (mascot) => (
                    <PersonAvatar
                      key={mascot.animal}
                      mascot={mascot}
                      size="sm"
                    />
                  ))}
                </AvatarGroup>
                <span className="text-foreground font-medium">
                  {t("demo-forum-replies", { count: DEMO_REPLIERS.length })}
                </span>
                <time>{demoTime(locale, 10)}</time>
              </span>
            </MessageFooter>
          </ForumMessage>
          <ForumMessage
            avatar={<Nina label="" lean="center" size={32} tile="cream" />}
            name="Nina"
            step={3}
            time={demoTime(locale, 4)}
          >
            <Bubble variant="secondary">
              <BubbleContent>{t("demo-forum-nina")}</BubbleContent>
            </Bubble>
          </ForumMessage>
        </MessageGroup>
      </FeatureCard>
    </FeatureRow>
  );
}
