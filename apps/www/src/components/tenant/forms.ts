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
 * Loads the code of the form that an entry address opens: the username form at `?sign-in=username`.
 * The school layout awaits it before the entry commits, for a visitor and for an outsider, whose card
 * way opens the username form while its account signs out, so the entry paints with its form in
 * place: a form that arrived later would move the centred title and legal notice, and the form holds
 * no loading boundary of its own. A press on the username link waits for it with the Google button
 * still in place.
 */
export async function loadEntryForm({
  signIn,
}: {
  signIn: "username" | undefined;
}) {
  if (signIn === "username") {
    await TenantLogin.preload?.();
  }
}
