import { Navigate, useLocation } from "@tanstack/react-router";
import { useLocale } from "use-intl";
import { getSignedInHref } from "@/lib/auth/admission";
import { readAuthReturnQuery } from "@/lib/auth/return";

/**
 * Sends a visitor who is already signed in on from the sign-in page: to the page
 * the intent names, or home. The page is static, so no gate ran before it for
 * this visitor, and the move replaces the sign-in page in the history.
 */
export function AuthForward() {
  const locale = useLocale();
  const search = useLocation({ select: (location) => location.search });
  const { redirect } = readAuthReturnQuery(search);

  return <Navigate href={getSignedInHref(redirect, locale)} replace />;
}
