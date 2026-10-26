import { useMutation } from "@confect/react";
import { Login03Icon, MailSend01Icon } from "@hugeicons/core-free-icons";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { getRouteApi } from "@tanstack/react-router";
import { Effect, Option, Schema } from "effect";
import { type FormEvent, useId, useState, useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { ConvexProvider } from "@/components/providers/convex";
import {
  GuardianSignInUnanswered,
  guardianCodeOf,
  guardianEmailOf,
  guardianSignInAnswerOf,
} from "@/components/tenant/guardian/code";
import { pageDeviceIdOf } from "@/components/tenant/signin";
import { clientEnv } from "@/env.public";
import { readAuthClient } from "@/lib/auth/client";

/** The school layout's route, whose parsed address holds the school's slug. */
const schoolRoute = getRouteApi("/school/$slug");

/**
 * A parent's sign-in on the school host (ADR 0009, ADR 0034): the address the school
 * linked, then the six-digit code that the school mails to it. The answer is the same for
 * every address, so the form never tells whether the school links one. The signed-out school
 * tree mounts no Convex provider, so the form mounts one for its code request.
 */
export function TenantGuardianSignIn() {
  return (
    <ConvexProvider convexUrl={clientEnv.VITE_CONVEX_URL}>
      <GuardianSignInForm />
    </ConvexProvider>
  );
}

/** The form under the provider of `TenantGuardianSignIn`, one step at a time. */
function GuardianSignInForm() {
  const t = useTranslations("SchoolGuardians");
  const slug = schoolRoute.useParams({ select: (params) => params.slug });
  const locale = Schema.decodeOption(ActiveAppLocaleCodeSchema)(useLocale());
  const id = useId();
  const send = useMutation(guardians.codes.send);
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);

  /** Asks the school to mail a code to the typed address, then shows the code step. */
  function requestCode() {
    const address = guardianEmailOf(email);
    if (Option.isNone(address) || Option.isNone(locale)) {
      setMessage(t("email-invalid"));
      return;
    }
    startTransition(async () => {
      setMessage(undefined);
      const deviceId = await Effect.runPromise(pageDeviceIdOf());
      const answered = await Effect.runPromise(
        Effect.tryPromise(() =>
          send({ deviceId, email: address.value, locale: locale.value, slug })
        ).pipe(Effect.option)
      );
      if (Option.isNone(answered)) {
        setMessage(t("failed"));
        return;
      }
      setSentTo(address.value);
      setCode("");
    });
  }

  /** Signs in with the typed code; a signed-in parent opens the parent home. */
  function signIn() {
    const typed = guardianCodeOf(code);
    if (Option.isNone(typed) || sentTo === undefined) {
      setMessage(t("code-invalid"));
      return;
    }
    startTransition(async () => {
      setMessage(undefined);
      const signedIn = await Effect.runPromise(
        Effect.tryPromise({
          try: () =>
            readAuthClient().$fetch("/school/guardian/sign-in", {
              body: { code: typed.value, email: sentTo },
              method: "POST",
            }),
          catch: () => new GuardianSignInUnanswered(),
        }).pipe(
          Effect.flatMap((answer) =>
            guardianSignInAnswerOf(answer.error?.status)
          ),
          Effect.option
        )
      );
      if (Option.isNone(signedIn)) {
        setMessage(t("failed"));
        return;
      }
      if (!signedIn.value) {
        setMessage(t("code-refused"));
        return;
      }
      // The session changed, so the school loads again with the session this sign-in set.
      window.location.assign("/orang-tua");
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sentTo === undefined) {
      requestCode();
      return;
    }
    signIn();
  }

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-6"
      data-slot="guardian-sign-in"
      onSubmit={handleSubmit}
    >
      <FieldGroup className="gap-4">
        {sentTo === undefined ? (
          <Field>
            <FieldLabel htmlFor={`${id}-email`}>{t("email-label")}</FieldLabel>
            <Input
              autoComplete="email"
              id={`${id}-email`}
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("email-placeholder")}
              type="email"
              value={email}
            />
            <FieldDescription>{t("email-description")}</FieldDescription>
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor={`${id}-code`}>{t("code-label")}</FieldLabel>
            <Input
              autoComplete="one-time-code"
              id={`${id}-code`}
              inputMode="numeric"
              maxLength={7}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
              value={code}
            />
            <FieldDescription>
              {t("code-description", { email: sentTo })}
            </FieldDescription>
          </Field>
        )}
      </FieldGroup>
      {message === undefined ? null : (
        <p className="text-destructive text-sm" role="alert">
          {message}
        </p>
      )}
      <div className="flex w-full flex-col gap-3">
        <Button
          aria-busy={isPending || undefined}
          className="w-full"
          disabled={isPending}
          type="submit"
        >
          <Spinner
            icon={sentTo === undefined ? MailSend01Icon : Login03Icon}
            isLoading={isPending}
          />
          {sentTo === undefined ? t("send-code") : t("sign-in")}
        </Button>
        {sentTo === undefined ? null : (
          <Button
            disabled={isPending}
            onClick={requestCode}
            type="button"
            variant="ghost"
          >
            <HugeIcons icon={MailSend01Icon} />
            {t("resend-code")}
          </Button>
        )}
      </div>
    </form>
  );
}
