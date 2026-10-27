import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useLocale } from "use-intl";
import { getSignedInHref } from "@/lib/auth/admission";
import { readAuthReturnQuery } from "@/lib/auth/return";

/**
 * Sends a visitor who is already signed in on from the sign-in page: to the page
 * the intent names, or home. The page is static, so no gate ran before it for
 * this visitor, and the move replaces the sign-in page in the history. The intent
 * is a validated path of any page, so the move takes an href, not a typed route.
 *
 * The intent is read once, from the address the page opened with. The move
 * itself changes the router's address before it ends, and an address without
 * the intent must not send the visitor home over the page they asked for.
 */
export function AuthForward() {
  const locale = useLocale();
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    const { redirect } = readAuthReturnQuery(router.state.location.search);
    navigate({ href: getSignedInHref(redirect, locale), replace: true });
  }, [locale, navigate, router]);

  return null;
}
