import { useNavigate, useRouter } from "@tanstack/react-router";
import { Option } from "effect";
import { useEffect } from "react";
import { useLocale } from "use-intl";
import { getPostAuthOnboardingHref } from "@/lib/auth/admission";
import { readAuthReturnQuery, readSchoolReturn } from "@/lib/auth/return";

/**
 * Sends a signed-in visitor on from the sign-in page: back to the school host
 * they came from, or through the first run to the page the intent names. Google
 * returns here, so this is also where a new sign-in ends, and the first run
 * either asks its questions or moves on at once. The move replaces the sign-in
 * page in the history. The intent is a validated path of any page, so the move
 * takes an href, not a typed route.
 *
 * The query is read once, from the address the page opened with. The move
 * itself changes the router's address before it ends, and an address without
 * the intent must not send the visitor home over the page they asked for.
 */
export function AuthForward() {
  const locale = useLocale();
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    const { redirect, school } = readAuthReturnQuery(
      router.state.location.search
    );
    const schoolReturn = readSchoolReturn(school, window.location);
    if (Option.isSome(schoolReturn)) {
      window.location.replace(schoolReturn.value);
      return;
    }
    navigate({
      href: getPostAuthOnboardingHref(redirect, locale),
      replace: true,
    });
  }, [locale, navigate, router]);

  return null;
}
