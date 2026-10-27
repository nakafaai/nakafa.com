import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useLocale } from "use-intl";
import { getSignedInHref } from "@/lib/auth/admission";
import { readAuthReturnQuery } from "@/lib/auth/return";

/**
 * Sends a visitor who is already signed in on from the sign-in page: to the page
 * the intent names, or home. The page is static, so no gate ran before it for
 * this visitor, and the move replaces the sign-in page in the history. The intent
 * is a validated path of any page, so the move takes an href, not a typed route.
 */
export function AuthForward() {
  const locale = useLocale();
  const navigate = useNavigate();
  const search = useLocation({ select: (location) => location.search });
  const { redirect } = readAuthReturnQuery(search);
  const href = getSignedInHref(redirect, locale);

  useEffect(() => {
    navigate({ href, replace: true });
  }, [href, navigate]);

  return null;
}
