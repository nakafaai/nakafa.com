"use client";

import { useMutation } from "@confect/react";
import identity from "@repo/backend/confect/_generated/refs/identity";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState, useTransition } from "react";
import { ConvexProvider } from "@/components/providers/convex";
import {
  pageDeviceIdOf,
  RedeemUnanswered,
  SignInUnanswered,
  signInAnswerOf,
  submitLogin,
} from "@/components/tenant/login.client";
import { clientEnv } from "@/env.client";
import { authClient } from "@/lib/auth/client";

/**
 * The school login form: the school username and a password, with an optional card code for
 * a first sign-in or a reissued card. A typed card code redeems the card and sets the password
 * first, and both paths then sign the student in on this host (ADR 0009). The answer names the
 * problem without telling whether the username exists. The signed-out school tree mounts no
 * Convex provider, so the form mounts one for its redemption.
 */
export function TenantLogin({ slug }: { slug: TenantSlug }) {
  return (
    <ConvexProvider convexUrl={clientEnv.NEXT_PUBLIC_CONVEX_URL}>
      <TenantLoginForm slug={slug} />
    </ConvexProvider>
  );
}

/**
 * The form under the provider of `TenantLogin`. Its hooks read that provider, so they cannot run
 * in the component that renders it.
 */
function TenantLoginForm({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolEntry");
  const id = useId();
  const redeem = useMutation(identity.cards.redeem);
  const [isPending, startTransition] = useTransition();
  const [loginName, setLoginName] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | undefined>(undefined);

  /** Submits the form. `submitLogin` decides the answer, and a signed-in student goes to the school root. */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setMessage(undefined);
      const deviceId = await Effect.runPromise(pageDeviceIdOf());
      const step = await Effect.runPromise(
        submitLogin(
          { code, deviceId, loginName, password, slug },
          {
            redeem: (request) =>
              Effect.tryPromise({
                try: () => redeem(request),
                catch: () => new RedeemUnanswered(),
              }),
            signIn: (credentials) =>
              Effect.tryPromise({
                try: () => authClient.signIn.username(credentials),
                catch: () => new SignInUnanswered(),
              }).pipe(
                Effect.flatMap((answer) => signInAnswerOf(answer.error?.status))
              ),
          }
        )
      );
      if (step === "signed-in") {
        window.location.assign("/");
        return;
      }
      setMessage(t(step));
    });
  }

  return (
    <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-username`}>
            {t("username-label")}
          </FieldLabel>
          <Input
            autoComplete="username"
            id={`${id}-username`}
            onChange={(event) => setLoginName(event.target.value)}
            value={loginName}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-code`}>{t("card-code-label")}</FieldLabel>
          <Input
            autoComplete="off"
            id={`${id}-code`}
            onChange={(event) => setCode(event.target.value)}
            value={code}
          />
          <FieldDescription>{t("card-code-description")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-password`}>
            {t("password-label")}
          </FieldLabel>
          <Input
            autoComplete={
              code.trim() === "" ? "current-password" : "new-password"
            }
            id={`${id}-password`}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
          <FieldDescription>{t("password-description")}</FieldDescription>
        </Field>
      </FieldGroup>
      {message === undefined ? null : (
        <p className="text-destructive text-sm" role="alert">
          {message}
        </p>
      )}
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">{t("username-footer")}</p>
        <Button
          aria-busy={isPending || undefined}
          disabled={isPending}
          type="submit"
        >
          {isPending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
