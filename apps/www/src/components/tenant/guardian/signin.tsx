import { useMutation } from "@confect/react";
import { Login03Icon, MailSend01Icon } from "@hugeicons/core-free-icons";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { getRouteApi } from "@tanstack/react-router";
import { Effect, Option, Schema } from "effect";
import { type FormEvent, useId, useReducer, useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { ConvexProvider } from "@/components/providers/convex";
import {
  GuardianSignInUnanswered,
  guardianCodeOf,
  guardianEmailOf,
  guardianSignInAnswerOf,
  SIGN_IN_START,
  stepSignIn,
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
  const [form, change] = useReducer(stepSignIn, SIGN_IN_START);

  /** Asks the school to mail a code to the typed address, then shows the code step. Resend asks for the same address. */
  function requestCode() {
    const address = guardianEmailOf(
      form._tag === "email" ? form.email : form.sentTo
    );
    if (Option.isNone(address) || Option.isNone(locale)) {
      change({ _tag: "refused", message: t("email-invalid") });
      return;
    }
    startTransition(async () => {
      change({ _tag: "waiting" });
      const deviceId = await Effect.runPromise(pageDeviceIdOf());
      const answered = await Effect.runPromise(
        Effect.tryPromise(() =>
          send({ deviceId, email: address.value, locale: locale.value, slug })
        ).pipe(Effect.option)
      );
      if (Option.isNone(answered)) {
        change({ _tag: "refused", message: t("failed") });
        return;
      }
      change({ _tag: "sent", address: address.value });
    });
  }

  /** Signs in with the typed code; a signed-in parent opens the parent home. */
  function signIn(code: string, sentTo: string) {
    const typed = guardianCodeOf(code);
    if (Option.isNone(typed)) {
      change({ _tag: "refused", message: t("code-invalid") });
      return;
    }
    startTransition(async () => {
      change({ _tag: "waiting" });
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
        change({ _tag: "refused", message: t("failed") });
        return;
      }
      if (!signedIn.value) {
        change({ _tag: "refused", message: t("code-refused") });
        return;
      }
      // The session changed, so the school loads again with the session this sign-in set.
      window.location.assign("/parents");
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form._tag === "email") {
      requestCode();
      return;
    }
    signIn(form.code, form.sentTo);
  }

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-6"
      data-slot="guardian-sign-in"
      onSubmit={handleSubmit}
    >
      <FieldGroup>
        {form._tag === "email" ? (
          <Field>
            <FieldLabel htmlFor={`${id}-email`}>{t("email-label")}</FieldLabel>
            <Input
              autoComplete="email"
              id={`${id}-email`}
              inputMode="email"
              onChange={(event) =>
                change({ _tag: "typed", text: event.target.value })
              }
              placeholder={t("email-placeholder")}
              type="email"
              value={form.email}
            />
            <FieldDescription>{t("email-description")}</FieldDescription>
            <FieldError>{form.message}</FieldError>
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor={`${id}-code`}>{t("code-label")}</FieldLabel>
            <Input
              autoComplete="one-time-code"
              id={`${id}-code`}
              inputMode="numeric"
              maxLength={7}
              onChange={(event) =>
                change({ _tag: "typed", text: event.target.value })
              }
              placeholder="123456"
              value={form.code}
            />
            {/* A long address takes two lines, which the field keeps, so a one-line refusal never moves the button. */}
            <FieldDescription className="min-h-[2lh]">
              {t("code-description", { email: form.sentTo })}
            </FieldDescription>
            <FieldError className="min-h-[2lh]">{form.message}</FieldError>
          </Field>
        )}
      </FieldGroup>
      <div className="flex w-full flex-col gap-3">
        <Button
          aria-busy={isPending || undefined}
          className="w-full"
          disabled={isPending}
          type="submit"
        >
          <Spinner
            icon={form._tag === "email" ? MailSend01Icon : Login03Icon}
            isLoading={isPending}
          />
          {form._tag === "email" ? t("send-code") : t("sign-in")}
        </Button>
        {form._tag === "email" ? null : (
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
