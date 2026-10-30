import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import {
  getRouteApi,
  lazyRouteComponent,
  useLocation,
  useMatchRoute,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { useEffect } from "react";
import { useTranslations } from "use-intl";
import { AuthGoogle } from "@/components/auth/google";
import { keepRoomCode } from "@/components/exams/sitting/scan";
import { signInReturn } from "@/components/tenant/resume";
import { Link } from "@/lib/routing/link";

/** The school layout's route, whose validated search holds the `sign-in` address. */
const schoolRoute = getRouteApi("/school/$slug");

/**
 * The school username form. Its code stays out of the entry's first JavaScript, and loads before the
 * entry commits at the address that opens it (`loadEntryForm`).
 */
const TenantLogin = lazyRouteComponent(
  () => import("@/components/tenant/login"),
  "TenantLogin"
);

/**
 * A parent's email code form (ADR 0034). Its code stays out of the entry's first JavaScript, and loads
 * before the entry commits at the parent address (`loadEntryForm`).
 */
const TenantGuardianSignIn = lazyRouteComponent(
  () => import("@/components/tenant/guardian/signin"),
  "TenantGuardianSignIn"
);

/**
 * Loads the code of the form that a visitor's entry address opens: the parent's code form at the
 * parent address, the username form at `?sign-in=username`. The school layout awaits it before the
 * entry commits, so the entry paints with its form in place, and a form that arrived later would move
 * the centred title and legal notice. A press on the username link waits for it with the Google
 * buttons still in place.
 */
export async function loadEntryForm({
  guardian,
  signIn,
}: {
  guardian: boolean;
  signIn: "username" | undefined;
}) {
  if (guardian) {
    await TenantGuardianSignIn.preload?.();
    return;
  }
  if (signIn === "username") {
    await TenantLogin.preload?.();
  }
}

/** Whether the visitor is on the parent address, `/parents`, whose sign-in is the email code. */
function useGuardianAddress() {
  const matchRoute = useMatchRoute();
  return matchRoute({ to: "/school/$slug/parents" }) !== false;
}

/**
 * The sign-in of a school host, one way at a time: Google with the links to the school username
 * form and to a parent's email code, the username form alone at the address `?sign-in=username`,
 * or the code form alone at the parent address `/parents`. Each address opens with its form in
 * place, so a visitor who signs out to sign in with a card lands on it. Google and the username form open
 * over the page the visitor is on and return to it, and the code of an exam room that a
 * student scanned waits in the tab while they sign in, so they land in the room.
 */
export function TenantEntryActions({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolEntry");
  const tGuardian = useTranslations("SchoolGuardians");
  const signIn = schoolRoute.useSearch({
    select: (search) => search["sign-in"],
  });
  const guardian = useGuardianAddress();
  const returnPath = useLocation({
    select: (location) => signInReturn(location.publicHref),
  });

  useEffect(() => {
    // A browser that keeps no session storage drops the code, and the student types the token.
    Effect.runPromise(
      keepRoomCode(window.location.pathname, window.location.hash).pipe(
        Effect.catchTag("RoomCodeStorageFailed", () => Effect.void)
      )
    );
  }, []);

  if (guardian) {
    return <TenantGuardianSignIn />;
  }

  if (signIn === "username") {
    return <TenantLogin />;
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <AuthGoogle returnPath={returnPath} />
      <Link
        className={buttonVariants({ variant: "outline" })}
        search={(previous) => ({ ...previous, "sign-in": "username" })}
      >
        {t("username-action")}
      </Link>
      <Link
        className={buttonVariants({ variant: "ghost" })}
        params={{ slug }}
        to="/school/$slug/parents"
      >
        {tGuardian("sign-in-action")}
      </Link>
    </div>
  );
}

/**
 * The way back from the username or parent form to Google, at the start of the entry header. The
 * username form returns to the page it opened over, and the parent form to the school root.
 */
export function TenantEntryBack({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("Common");
  const signIn = schoolRoute.useSearch({
    select: (search) => search["sign-in"],
  });
  const guardian = useGuardianAddress();

  if (guardian) {
    return (
      <Link
        className={buttonVariants({ variant: "outline" })}
        params={{ slug }}
        to="/school/$slug"
      >
        <HugeIcons icon={ArrowLeft01Icon} />
        {t("back")}
      </Link>
    );
  }

  if (signIn !== "username") {
    return null;
  }

  return (
    <Link
      className={buttonVariants({ variant: "outline" })}
      search={(previous) => ({ ...previous, "sign-in": undefined })}
    >
      <HugeIcons icon={ArrowLeft01Icon} />
      {t("back")}
    </Link>
  );
}
