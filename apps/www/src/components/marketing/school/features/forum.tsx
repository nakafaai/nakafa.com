import { HashtagIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { AvatarGroup } from "@repo/design-system/components/ui/avatar";
import { Card } from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import { Nina } from "@repo/design-system/components/ui/nina";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { Array as Arr, String as Str } from "effect";
import { useLocale, useTranslations } from "use-intl";
import {
  DEMO_ASKER,
  DEMO_REPLIERS,
  DEMO_TEACHER,
} from "@/components/marketing/school/features/cast";
import { ForumChat } from "@/components/marketing/school/features/chat";
import { ChannelTalk } from "@/components/marketing/school/features/chats";
import { demoTime } from "@/components/marketing/school/features/clock";
import { RoomChannel } from "@/components/marketing/school/features/room";
import {
  RoomProvider,
  useRoom,
} from "@/components/marketing/school/features/scope";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";

/** When each chat's newest message came, in minutes from the demo's moment, and whether it waits unread. */
const CHAT_LAST = {
  general: { minutes: -142, unread: false },
  lab: { minutes: -47, unread: true },
  momentum: { minutes: 4, unread: false },
} as const;

/** The name of a chat as the list and the chat's head write it: the general chat by its label, a topic by its name. */
function useChannelName() {
  const t = useTranslations("SchoolSite");
  const tClass = useTranslations("Classroom");

  return (channel: typeof RoomChannel.Type) =>
    channel === "general"
      ? tClass("general-channel")
      : t(`demo-channel-${channel}`);
}

/** How a chat's newest message reads in the list: its author and how it starts. */
function useChannelPreview() {
  const t = useTranslations("SchoolSite");
  const tClass = useTranslations("Classroom");

  return {
    general: `${t("demo-teacher")}: ${t("demo-forum-general")}`,
    lab: `${DEMO_ASKER.name}: ${t("demo-forum-lab")}`,
    momentum: `${tClass("nina-author")}: ${t("demo-forum-nina")}`,
  };
}

/** One chat of the list, as the forum lists it: its mark, its name, when its newest message came, and how it starts. */
function RailItem({ channel }: { channel: typeof RoomChannel.Type }) {
  const t = useTranslations("Classroom");
  const locale = useLocale();
  const name = useChannelName();
  const preview = useChannelPreview();
  const isOpen = useRoom((state) => state.channel === channel);
  const isRead = useRoom((state) => Arr.contains(state.opened, channel));
  const open = useRoom((state) => state.open);
  const last = CHAT_LAST[channel];

  return (
    <Item
      className="hover:bg-muted data-open:bg-accent relative"
      data-open={isOpen ? "" : undefined}
      render={<li />}
      size="sm"
    >
      <ItemMedia className="text-muted-foreground" variant="icon">
        <HugeIcons icon={HashtagIcon} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <button
            aria-current={isOpen ? "true" : undefined}
            className="focus-visible:after:ring-ring/50 flex min-w-0 flex-1 items-center gap-2 text-start font-medium outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:ring-2"
            onClick={() => open(channel)}
            type="button"
          >
            <span className="min-w-0 truncate">{name(channel)}</span>
            {last.unread && !isRead ? (
              <span className="bg-foreground size-2 shrink-0 rounded-full">
                <span className="sr-only">{t("unread")}</span>
              </span>
            ) : null}
          </button>
          <time className="text-muted-foreground shrink-0 text-xs font-normal tabular-nums">
            {demoTime(locale, last.minutes)}
          </time>
        </ItemTitle>
        <ItemDescription className="truncate">
          {preview[channel]}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}

/** The list of the class's chats beside the open one, with the search over their names, as the forum keeps it. */
function ForumRail() {
  const t = useTranslations("Classroom");
  const name = useChannelName();
  const query = useRoom((state) => state.query);
  const search = useRoom((state) => state.search);
  const shown = Arr.filter(RoomChannel.literals, (channel) =>
    Str.includes(Str.toLowerCase(query.trim()))(Str.toLowerCase(name(channel)))
  );

  return (
    <nav
      aria-label={t("channels-title")}
      className="hidden min-h-0 flex-col gap-3 border-e p-3 md:flex"
    >
      <InputGroup>
        <InputGroupAddon>
          <HugeIcons icon={Search01Icon} />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={t("channels-search")}
          onChange={(event) => search(event.target.value)}
          placeholder={t("channels-search")}
          value={query}
        />
      </InputGroup>
      <ul className="grid gap-0.5">
        {Arr.map(shown, (channel) => (
          <RailItem channel={channel} key={channel} />
        ))}
      </ul>
    </nav>
  );
}

/** The head of the open chat: its mark and name, and the faces of the class that reads it. */
function ChatHead() {
  const name = useChannelName();
  const channel = useRoom((state) => state.channel);

  return (
    <div className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b px-4">
      <p className="flex min-w-0 items-center gap-2 font-medium">
        <HugeIcons className="text-muted-foreground" icon={HashtagIcon} />
        <span className="truncate">{name(channel)}</span>
      </p>
      <AvatarGroup>
        <PersonAvatar
          aria-hidden="true"
          mascot={DEMO_TEACHER.mascot}
          size="sm"
        />
        <PersonAvatar aria-hidden="true" mascot={DEMO_ASKER.mascot} size="sm" />
        {Arr.map(DEMO_REPLIERS, (mascot) => (
          <PersonAvatar
            aria-hidden="true"
            key={mascot.animal}
            mascot={mascot}
            size="sm"
          />
        ))}
      </AvatarGroup>
    </div>
  );
}

/**
 * The forum part: under Nina and her words, a class's forum as the School draws it, a chat app. The list of the
 * class's chats stands beside the open chat on a wide screen, and a press opens another; a phone shows the open chat,
 * as the forum does once a chat opens. A student asks, the teacher answers with the worksheet and a thread, Nina
 * writes her reply as the chat comes into view, every emoji takes a press, and the composer posts the reader's own
 * message into the open chat.
 */
export function SchoolForum() {
  return (
    <FeatureRow id="forum" layout="wide">
      <SchoolFeatureText feature="forum">
        <Nina act="typing" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureProduct>
        <RoomProvider>
          <Card className="mx-auto w-full max-w-5xl gap-0 py-0">
            <div className="grid min-h-0 md:h-144 md:grid-cols-[17rem_minmax(0,1fr)]">
              <ForumRail />
              <section className="flex min-h-0 min-w-0 flex-col">
                <ChatHead />
                <ChannelTalk />
                <ForumChat />
              </section>
            </div>
          </Card>
        </RoomProvider>
      </FeatureProduct>
    </FeatureRow>
  );
}
