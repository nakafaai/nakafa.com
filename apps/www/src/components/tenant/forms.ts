import { lazyRouteComponent } from "@tanstack/react-router";

/**
 * The school username form. Its code stays out of the entry's first JavaScript, and loads before the
 * entry commits at the address that opens it (`loadEntryForm`).
 */
export const TenantLogin = lazyRouteComponent(
  () => import("@/components/tenant/login"),
  "TenantLogin"
);

/**
 * A parent's email code form (ADR 0034). Its code stays out of the entry's first JavaScript, and loads
 * before the entry commits at the parent address (`loadEntryForm`).
 */
export const TenantGuardianSignIn = lazyRouteComponent(
  () => import("@/components/tenant/guardian/signin"),
  "TenantGuardianSignIn"
);

/**
 * Loads the code of the form that an entry address opens: the parent's code form at the parent
 * address, the username form at `?sign-in=username`. The school layout awaits it before the entry
 * commits, for a visitor and for an outsider, whose card way opens the username form while its
 * account signs out, so the entry paints with its form in place: a form that arrived later would move
 * the centred title and legal notice, and the forms hold no loading boundary of their own. A press on
 * the username link waits for it with the Google buttons still in place.
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
