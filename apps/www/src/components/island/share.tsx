"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
import {
  Copy01Icon,
  Globe02Icon,
  Link01Icon,
  LockIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import island from "@repo/backend/confect/_generated/refs/island";
import { Access } from "@repo/backend/confect/island/schema";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { GuestsBlank } from "@/components/island/blank";
import { HudSheet } from "@/components/island/sheet";
import { StickerMark } from "@/components/island/sticker";
import { useGame } from "@/components/island/store";
import { useViewer } from "@/lib/identity/client";
import { useCurrentLocale } from "@/lib/routing/link";

/** The icon of each choice of who a world opens to. */
const ACCESS_ICONS = {
  link: Link01Icon,
  private: LockIcon,
  public: Globe02Icon,
} as const;

/** Whether a toggle's value names one of the three choices. */
const isAccess = Schema.is(Access);

/** The world's address (ADR 0050, W6), `/{locale}/island/{username}`, in a field with the press that copies it. */
function Address() {
  const t = useTranslations("Island");
  const tCommon = useTranslations("Common");
  const locale = useCurrentLocale();
  const clipboard = useClipboard({ timeout: 1500 });
  const username = useViewer((state) => state.account?.appUser.username);
  if (username === undefined) {
    return null;
  }
  const address = new URL(`/${locale}/island/${username}`, SITE_ORIGIN).href;
  return (
    <div className="flex gap-2 max-sm:flex-col">
      <Input
        aria-label={t("share-address")}
        className="h-11 min-w-0 sm:flex-1"
        onFocus={(event) => event.currentTarget.select()}
        placeholder={t("share-address")}
        readOnly
        value={address}
      />
      <Button
        className="h-11"
        onClick={() => clipboard.copy(address)}
        type="button"
        variant="outline"
      >
        <HugeIcons icon={clipboard.copied ? Tick01Icon : Copy01Icon} />
        {tCommon("copy")}
      </Button>
    </div>
  );
}

/**
 * Who the world opens to beside its owner (ADR 0050, W6): nobody, whoever
 * holds its address, or anyone, with one sentence on what the choice means.
 * The choice shows at once and goes back when the server does not take it.
 */
function AccessChoice() {
  const t = useTranslations("Island");
  const own = useQuery(island.queries.own, {});
  const share = useMutation(island.mutations.share);
  const setNotice = useGame((state) => state.setNotice);
  const [chosen, setChosen] = useState<Option.Option<typeof Access.Type>>(
    Option.none
  );
  if (!QueryResult.isSuccess(own) || own.value === null) {
    return null;
  }
  const stored = own.value.access;
  const access = Option.getOrElse(chosen, () => stored);
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{t("access-title")}</h3>
      <ToggleGroup
        aria-label={t("access-title")}
        gridColumns="3"
        onValueChange={(value) => {
          if (!isAccess(value)) {
            return;
          }
          setChosen(Option.some(value));
          Effect.runFork(
            Effect.tryPromise(() => share({ access: value })).pipe(
              Effect.flatMap((result) => Effect.fromResult(result)),
              Effect.catch(() =>
                Effect.sync(() => {
                  setChosen(Option.none());
                  setNotice("refused");
                })
              )
            )
          );
        }}
        value={access}
      >
        {Arr.map(Access.literals, (choice) => (
          <ToggleGroupItem className="h-11" key={choice} value={choice}>
            <HugeIcons icon={ACCESS_ICONS[choice]} />
            {t(`access-${choice}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-muted-foreground text-sm">
        {t(`access-${access}-hint`)}
      </p>
    </section>
  );
}

/**
 * The guest book (ADR 0050, W6): who came, by first name and animal, the
 * sticker they left and the day, with those who came since the learner last
 * entered marked.
 */
function GuestBook() {
  const t = useTranslations("Island");
  const format = useFormatter();
  const guests = useQuery(island.queries.guests, {});
  const entered = useGame((state) => state.entered);
  if (!QueryResult.isSuccess(guests)) {
    return null;
  }
  if (guests.value.length === 0) {
    return <GuestsBlank />;
  }
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{t("guests-title")}</h3>
      <ul className="flex flex-col">
        {Arr.map(guests.value, (guest) => (
          <li
            className="flex min-h-11 items-center gap-2 border-b py-1.5 text-sm last:border-b-0"
            key={`${guest.at}-${guest.name}`}
          >
            <PersonAvatar className="size-8" mascot={guest.mascot} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{guest.name}</span>
              <time className="text-muted-foreground text-xs tabular-nums">
                {format.dateTime(guest.at, "day")}
              </time>
            </span>
            {entered === null || guest.at > entered ? (
              <Badge variant="secondary">{t("guest-new")}</Badge>
            ) : null}
            <StickerMark sticker={guest.sticker} />
            <span className="sr-only">{t(`sticker-${guest.sticker}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The share sheet of the learner's own world (ADR 0050, W6): its address to
 * copy, who it opens to, and the guest book.
 */
export function ShareSheet() {
  const t = useTranslations("Island");
  return (
    <HudSheet
      description={t("share-description")}
      sheet="share"
      title={t("share-title")}
    >
      <div className="flex flex-col gap-6">
        <Address />
        <AccessChoice />
        <GuestBook />
      </div>
    </HudSheet>
  );
}
