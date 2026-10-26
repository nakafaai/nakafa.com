import { useMutation } from "@confect/react";
import { Login03Icon } from "@hugeicons/core-free-icons";
import identity from "@repo/backend/confect/_generated/refs/identity";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Effect } from "effect";
import { type FormEvent, useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { ConvexProvider } from "@/components/providers/convex";
import {
  pageDeviceIdOf,
  RedeemUnanswered,
  SignInUnanswered,
  signInAnswerOf,
  submitLogin,
} from "@/components/tenant/signin";
import { clientEnv } from "@/env.public";
import { readAuthClient } from "@/lib/auth/client";

/**
 * The school login form: the school username and a password, with an optional card code for
 * a first sign-in or a reissued card, which its placeholder names. A typed card code redeems the card and sets the password
 * first, and both paths then sign the student in on this host (ADR 0009). The answer names the
 * problem without telling whether the username exists. The signed-out school tree mounts no
 * Convex provider, so the form mounts one for its redemption.
 */
export function TenantLogin({ slug }: { slug: TenantSlug }) {
  return (
    <ConvexProvider convexUrl={clientEnv.VITE_CONVEX_URL}>
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
                try: () => readAuthClient().signIn.username(credentials),
                catch: () => new SignInUnanswered(),
              }).pipe(
                Effect.flatMap((answer) => signInAnswerOf(answer.error?.status))
              ),
          }
        )
      );
      if (step === "signed-in") {
        // The session changed, so the school loads again and its client starts
        // with the session that this sign-in set.
        window.location.assign("/");
        return;
      }
      setMessage(t(step));
    });
  }

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-6"
      onSubmit={handleSubmit}
    >
      <p className="text-center text-muted-foreground text-sm">
        {t("card-hint")}
      </p>
      <FieldGroup className="gap-4">
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
            placeholder={t("card-code-placeholder")}
            value={code}
          />
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
        </Field>
      </FieldGroup>
      {message === undefined ? null : (
        <p className="text-destructive text-sm" role="alert">
          {message}
        </p>
      )}
      <Button
        aria-busy={isPending || undefined}
        className="w-full"
        disabled={isPending}
        type="submit"
      >
        <Spinner icon={Login03Icon} isLoading={isPending} />
        {t("submit")}
      </Button>
    </form>
  );
}
