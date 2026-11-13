import { BrandLogo } from "@repo/design-system/components/logos/brand";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useEarlyPress } from "@repo/design-system/hooks/press";
import { ClientOnly, useLocation } from "@tanstack/react-router";
import { useConvex } from "convex/react";
import { Effect, Option } from "effect";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useStore } from "zustand";
import { signInReturn } from "@/components/tenant/resume";
import { reportClientException } from "@/lib/analytics/client";
import { oauthFailure, startGoogleSignIn } from "@/lib/auth/client";
import { useCurrentAuthNavigation } from "@/lib/auth/location";
import {
  googleReturnAddress,
  mainSignInAddress,
  readAuthReturnQuery,
  readSchoolReturn,
} from "@/lib/auth/return";

/**
 * Renders the Google sign-in button of the main site. Google returns to the
 * sign-in page on this origin, where the page's client completes the sign-in,
 * and that page sends the visitor on: to the intent through the first run, or
 * back to the school host the visitor came from. The button renders under
 * several routes, so it reads the sign-in query of the address itself.
 */
export function AuthGoogle() {
  const locale = useLocale();
  const t = useTranslations("Auth");
  const convex = useConvex();
  const search = useLocation({ select: (location) => location.search });
  const { redirect, school } = readAuthReturnQuery(search);
  const providerFailed = useStore(oauthFailure, (state) => state.failed);
  const [hasClientError, setHasClientError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const authNavigation = useCurrentAuthNavigation();
  const press = useEarlyPress<HTMLButtonElement>(handleGoogleSignIn);

  /** Starts Convex Auth's Google flow with one safe return address. */
  function handleGoogleSignIn() {
    setHasClientError(false);
    startTransition(async () => {
      const redirectTo = googleReturnAddress({
        intent: redirect ?? authNavigation.readIntentSource(),
        locale,
        origin: window.location.origin,
        school: readSchoolReturn(school, window.location),
      });
      const started = await Effect.runPromise(
        startGoogleSignIn(convex, redirectTo).pipe(
          Effect.tapError((error) =>
            reportClientException(error, { source: "google-sign-in" })
          ),
          Effect.isSuccess
        )
      );
      if (!started) {
        startTransition(() => setHasClientError(true));
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* The label stays one width while Google opens, and the button says it is
          busy: a spinner takes the logo's place. A failure shows below it. */}
      <Button aria-busy={isPending || undefined} disabled={isPending} {...press}>
        {isPending ? <Spinner /> : <BrandLogo name="google" />}
        {t("continue-with-google")}
      </Button>
      {/* The sign-in page is static and prerendered, so a failure that Google's
          return reports shows once the page has hydrated, under the button. */}
      <ClientOnly fallback={null}>
        {hasClientError || providerFailed ? <GoogleFailure /> : null}
      </ClientOnly>
    </div>
  );
}

/** Says that Google's sign-in did not finish, under the button that retries it. */
function GoogleFailure() {
  const t = useTranslations("Toast");
  return (
    <div className="text-destructive max-w-sm text-center text-sm" role="alert">
      <p className="font-medium">{t("provider-error.title")}</p>
      <p>{t("provider-error.description")}</p>
    </div>
  );
}

/**
 * The Google button of a school host. Google's flow completes on the origin
 * that starts it, so a school host sends the visitor to the main site's
 * sign-in page, which returns them here, to the page they are on, once signed
 * in; the session cookie reaches every school host (ADR 0026).
 */
export function SchoolGoogle() {
  const locale = useLocale();
  const t = useTranslations("Auth");
  const press = useEarlyPress<HTMLButtonElement>(() => {
    const school = new URL(
      signInReturn(window.location.href),
      window.location.href
    );
    const address = mainSignInAddress(school, locale);
    if (Option.isSome(address)) {
      window.location.assign(address.value);
    }
  });

  return (
    <Button {...press}>
      <BrandLogo name="google" />
      {t("continue-with-google")}
    </Button>
  );
}
