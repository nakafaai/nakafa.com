import { UserSwitchIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { getRouteApi, useMatchRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { lazy, Suspense, useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { EntryShellArtwork } from "@/components/entry/artwork";
import {
  EntryShell,
  EntryShellBody,
  EntryShellHeader,
  EntryShellPanel,
} from "@/components/entry/shell";
import { ThemePicker } from "@/components/shared/theme/picker";
import { TenantEntry } from "@/components/tenant/entry";
import {
  type OutsiderWay,
  TenantOutsiderActions,
} from "@/components/tenant/leave";
import { SchoolMark } from "@/components/tenant/mark";
import { signOutSchoolAccount } from "@/components/tenant/signout";

/** The school layout's route, which holds the school's profile and the search. */
const schoolRoute = getRouteApi("/school/$slug");

/**
 * The room join of an outsider on a room's address or `/join`. It loads with those pages only, so its
 * form and Convex client stay out of the outsider page's first JavaScript elsewhere.
 */
const OutsiderRoom = lazy(() =>
  import("@/components/tenant/room").then((module) => ({
    default: module.OutsiderRoom,
  }))
);

/**
 * Whether the outsider is on the address of an exam room, which a scanned QR code opens, or on the
 * school's `/join`, where a student types a room's code alone.
 */
function useRoomAddress() {
  const matchRoute = useMatchRoute();
  return (
    matchRoute({ to: "/school/$slug/sittings/$sitting" }) !== false ||
    matchRoute({ to: "/school/$slug/join" }) !== false
  );
}

/**
 * The page of a signed-in visitor who is not a member of the school. Its title names the school,
 * one sentence names the account and why it cannot enter, and the actions offer the ways in. A
 * way that leaves the account, switching it or signing in with a card, shows the school's sign-in
 * at once while the sign-out runs, and keeps it once the account has left; a failed sign-out
 * returns here with its toast. On an exam room's address the page is the room's join instead: the
 * account types the proctor's token, or brings a scanned one, and joins the school as a student.
 */
export function TenantOutsider({
  account,
  school,
}: {
  account: string;
  school: string;
}) {
  const t = useTranslations("SchoolEntry");
  const tSchool = useTranslations("School");
  const { logo, mascot } = schoolRoute.useRouteContext().school.profile;
  const navigate = schoolRoute.useNavigate();
  const [left, setLeft] = useState(false);
  const [leaving, setLeaving] = useOptimistic(left);
  const [, startLeaving] = useTransition();
  const room = useRoomAddress();

  /** Shows the sign-in of the chosen way at once, then signs the account out. */
  function leave(way: OutsiderWay) {
    startLeaving(async () => {
      setLeaving(true);
      await navigate({ search: way === "card" ? { masuk: "username" } : {} });
      const destination = await Effect.runPromise(signOutSchoolAccount());
      if (destination === "home") {
        setLeft(true);
      }
    });
  }

  if (leaving) {
    return <TenantEntry title={tSchool("sign-in-title", { school })} />;
  }

  return (
    <EntryShell>
      <EntryShellPanel>
        <EntryShellHeader>
          <div className="ms-auto">
            <ThemePicker variant="ghost" />
          </div>
        </EntryShellHeader>

        <EntryShellBody>
          <SchoolMark logo={logo} mascot={mascot} size="lg" />

          {room ? (
            <OutsiderRoomWay
              account={account}
              onLeave={leave}
              school={school}
            />
          ) : (
            <>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-balance font-semibold text-2xl">
                  {t("outsider-title", { school })}
                </h1>
                <p className="text-balance text-muted-foreground">
                  {t("outsider-description", { account })}
                </p>
              </div>

              <TenantOutsiderActions onLeave={leave} />
            </>
          )}
        </EntryShellBody>
      </EntryShellPanel>
      <EntryShellArtwork />
    </EntryShell>
  );
}

/**
 * The way into an exam room for an outsider: one sentence that names the account and the school,
 * the token form, and Switch account for a student signed in with the wrong account.
 */
function OutsiderRoomWay({
  account,
  onLeave,
  school,
}: {
  account: string;
  onLeave: (way: OutsiderWay) => void;
  school: string;
}) {
  const t = useTranslations("Exams");
  const tEntry = useTranslations("SchoolEntry");

  return (
    <>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-balance font-semibold text-2xl">
          {t("join-room-title")}
        </h1>
        <p className="text-balance text-muted-foreground">
          {t("join-room-description", { account, school })}
        </p>
      </div>
      <Suspense fallback={null}>
        <OutsiderRoom />
      </Suspense>
      <Button onClick={() => onLeave("switch")} variant="ghost">
        <HugeIcons aria-hidden="true" icon={UserSwitchIcon} />
        {tEntry("outsider-switch")}
      </Button>
    </>
  );
}
