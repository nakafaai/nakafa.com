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
import { Effect, Option, Result } from "effect";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState, useTransition } from "react";
import {
  pageDeviceIdOf,
  redeemRefusalKey,
  redeemRequestOf,
} from "@/components/tenant/login.client";
import { authClient } from "@/lib/auth/client";

/**
 * The school login form: the school username and a password, with an optional card code for
 * a first sign-in or a reissued card. A typed card code redeems the card and sets the password
 * first, and both paths then sign the student in on this host (ADR 0009). The answer names the
 * problem without telling whether the username exists.
 */
export function TenantLogin({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolEntry");
  const id = useId();
  const redeem = useMutation(identity.cards.redeem);
  const [isPending, startTransition] = useTransition();
  const [loginName, setLoginName] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | undefined>(undefined);

  /** Redeems the card when a code is typed, then signs the student in with the password. */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setMessage(undefined);
      if (code.trim() !== "") {
        const deviceId = await Effect.runPromise(pageDeviceIdOf());
        const request = redeemRequestOf({
          code,
          deviceId,
          loginName,
          password,
          slug,
        });
        if (Option.isNone(request)) {
          setMessage(t("card-invalid"));
          return;
        }
        const redeemed = await Effect.runPromise(
          Effect.tryPromise(() => redeem(request.value)).pipe(Effect.result)
        );
        if (Result.isFailure(redeemed)) {
          setMessage(t("failed"));
          return;
        }
        if (redeemed.success.outcome === "refused") {
          setMessage(t(redeemRefusalKey(redeemed.success.reason)));
          return;
        }
      }
      const signedIn = await authClient.signIn.username({
        password,
        username: loginName,
      });
      if (signedIn.error) {
        setMessage(t("sign-in-refused"));
        return;
      }
      window.location.assign("/");
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
            autoComplete="current-password"
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
