import {
  Avatar,
  AvatarFallback,
} from "@repo/design-system/components/ui/avatar";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSeparator,
} from "@repo/design-system/components/ui/sidebar-menu";
import { ClientOnly } from "@tanstack/react-router";
import { Effect, Function as Fn, Option } from "effect";
import { lazy, Suspense, useSyncExternalStore } from "react";
import { useTranslations } from "use-intl";
import { useLiveSession } from "@/components/providers/live";
import { AccountButtonFace } from "@/components/sidebar/menu/face";
import { PricingItem } from "@/components/sidebar/menu/pricing";
import { loadKnownSession } from "@/lib/auth/known";
import { loadKnownAccountText, readKnownAccount } from "@/lib/identity/known";

const PersonAvatar = lazy(() =>
  import("@repo/design-system/components/ui/person").then((module) => ({
    default: module.PersonAvatar,
  }))
);

/** What the browser keeps under a mounted footer changes only with a new page, so nothing notifies. */
function subscribeKept() {
  return Fn.constVoid;
}

/** The account row the browser kept, as its stored text. */
function readKeptText() {
  return Effect.runSync(loadKnownAccountText());
}

/** The session the browser last had. */
function readKeptSession() {
  return Effect.runSync(loadKnownSession());
}

/** The server keeps nothing for the browser. */
function readNothing() {
  return null;
}

/**
 * The account row the browser kept, in the page's first frame. The server
 * draws the row with no account in it, and the pre-paint script
 * (`lib/identity/prepaint.ts`) shows it with the kept plan and name before the
 * first paint, so the footer stands at its final size from the start. It holds
 * the footer while the live session and the account load. Once the session has
 * settled, a row kept for another session or for none is gone, and so is the
 * row of a page whose session failed to load.
 */
export function KeptAccount() {
  const hasError = useLiveSession((state) => state.hasError);
  const settled = useLiveSession(
    (state) => Option.isSome(state.client) && !state.isPending
  );
  const sessionId = useLiveSession((state) => state.sessionId);
  const text = useSyncExternalStore(subscribeKept, readKeptText, readNothing);

  if (hasError) {
    return null;
  }
  if (settled && Option.isNone(readKnownAccount(text, sessionId))) {
    return null;
  }
  return <KeptAccountRow />;
}

/**
 * The row itself: the pricing row of the free plan, then the account button.
 * The parts that depend on the account are chosen by the root's kept plan and
 * read the kept name from `--kept-account-name` (`styles/globals.css`). It is
 * inert, so a press waits for the live row, which draws the same face.
 */
function KeptAccountRow() {
  const t = useTranslations("Auth");
  return (
    <li className="contents" data-kept-account inert>
      <ul className="contents">
        <li className="contents" data-kept-plan-part="free">
          <ul className="contents">
            <PricingItem />
            <SidebarMenuSeparator />
          </ul>
        </li>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">
            <AccountButtonFace
              avatar={<KeptAvatar />}
              description={
                <>
                  <span data-kept-plan-part="free">{t("plan-free")}</span>
                  <span data-kept-plan-part="pro">{t("plan-pro")}</span>
                </>
              }
              name={<span className="before:content-(--kept-account-name)" />}
            />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </ul>
    </li>
  );
}

/** The kept account's picture, drawn once the page has its scripts, in a circle that holds its place before. */
function KeptAvatar() {
  return (
    <ClientOnly fallback={<EmptyAvatar />}>
      <Suspense fallback={<EmptyAvatar />}>
        <KeptPicture />
      </Suspense>
    </ClientOnly>
  );
}

/** The picture of the row the browser kept for its last session. */
function KeptPicture() {
  const text = useSyncExternalStore(subscribeKept, readKeptText, readNothing);
  const session = useSyncExternalStore(
    subscribeKept,
    readKeptSession,
    readNothing
  );
  return Option.match(readKnownAccount(text, session), {
    onNone: () => <EmptyAvatar />,
    onSome: ({ mascot, photo }) => (
      <PersonAvatar mascot={mascot} photo={photo} />
    ),
  });
}

/** The circle a picture stands in. */
function EmptyAvatar() {
  return (
    <Avatar>
      <AvatarFallback />
    </Avatar>
  );
}
