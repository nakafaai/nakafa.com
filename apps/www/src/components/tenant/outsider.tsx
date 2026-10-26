import { getRouteApi } from "@tanstack/react-router";
import { Effect } from "effect";
import { useOptimistic, useState, useTransition } from "react";
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
 * The page of a signed-in visitor who is not a member of the school. Its title names the school,
 * one sentence names the account and why it cannot enter, and the actions offer the ways in. A
 * way that leaves the account, switching it or signing in with a card, shows the school's sign-in
 * at once while the sign-out runs, and keeps it once the account has left; a failed sign-out
 * returns here with its toast.
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

          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-balance font-semibold text-2xl">
              {t("outsider-title", { school })}
            </h1>
            <p className="text-balance text-muted-foreground">
              {t("outsider-description", { account })}
            </p>
          </div>

          <TenantOutsiderActions onLeave={leave} />
        </EntryShellBody>
      </EntryShellPanel>
      <EntryShellArtwork />
    </EntryShell>
  );
}
