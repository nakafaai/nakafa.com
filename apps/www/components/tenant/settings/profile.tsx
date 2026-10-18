"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { LogoType } from "@repo/backend/confect/tenancy/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { Effect, Schema } from "effect";
import { useTranslations } from "next-intl";
import { startTransition, useRef, useState } from "react";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
  CardSectionHint,
} from "@/components/shared/card/section";
import { logoRefusalOf } from "@/components/tenant/logo.client";
import { SchoolMark } from "@/components/tenant/mark";
import { removeLogoChange } from "@/components/tenant/settings/mutation.client";
import { saveSchool } from "@/components/tenant/settings/save.client";
import { storeSchoolLogo } from "@/components/tenant/settings/upload.client";
import { reportClientException } from "@/lib/analytics/client";

const SOURCE = "components/tenant/settings/profile";

/** The copy of a logo the page refuses before it uploads anything. */
const LOGO_SIZE_REFUSED: ToastCopy = {
  description: "school-logo-size.description",
  title: "school-logo-size.title",
};
const LOGO_TYPE_REFUSED: ToastCopy = {
  description: "school-logo-type.description",
  title: "school-logo-type.title",
};
const ADDRESS_COPIED: ToastCopy = {
  title: "school-address-copied.title",
};

/**
 * Renders the profile of the school: its mark, its name, and its address with a
 * copy action. The settings pages read the school on the client, so a logo that
 * changes shows at once.
 */
export function SchoolProfileSettings({ slug }: { slug: TenantSlug }) {
  const viewer = useQuery(tenancy.viewer.get, { slug });

  if (!QueryResult.isSuccess(viewer)) {
    return null;
  }

  return <SchoolProfileCard slug={slug} tenant={viewer.value.tenant} />;
}

/** Renders the profile card, with the logo controls in its footer. */
function SchoolProfileCard({
  slug,
  tenant,
}: {
  slug: TenantSlug;
  tenant: {
    readonly logo?: string | undefined;
    readonly mascot: Parameters<typeof SchoolMark>[0]["mascot"];
    readonly name: string;
  };
}) {
  const t = useTranslations("SchoolSettings");
  const fileInput = useRef<HTMLInputElement>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const requestUrl = useMutation(tenancy.logo.uploadUrl);
  const setLogo = useMutation(tenancy.logo.set);
  const removeLogo = useMutation(tenancy.logo.remove).withOptimisticUpdate(
    removeLogoChange
  );
  const address = `${slug}.${MAIN_DOMAIN}`;

  const chooseLogo = (file: File) => {
    const contentType = file.type;
    const refusal = logoRefusalOf(file);
    if (refusal === "size") {
      toast.error(LOGO_SIZE_REFUSED);
      return;
    }
    if (refusal === "type" || !Schema.is(LogoType)(contentType)) {
      toast.error(LOGO_TYPE_REFUSED);
      return;
    }
    startTransition(() =>
      saveSchool(
        () =>
          storeSchoolLogo({
            file,
            requestUrl: () => requestUrl({ slug }),
            save: (storageId) => setLogo({ contentType, slug, storageId }),
          }),
        SOURCE
      )
    );
  };

  const takeLogoOff = () => {
    setIsRemoving(false);
    startTransition(() => saveSchool(() => removeLogo({ slug }), SOURCE));
  };

  const copyAddress = () => {
    Effect.runPromise(
      Effect.tryPromise(() => navigator.clipboard.writeText(address)).pipe(
        Effect.matchEffect({
          onSuccess: () =>
            Effect.sync(() => {
              toast.success(ADDRESS_COPIED);
            }),
          onFailure: (error) =>
            reportClientException(error, { source: SOURCE }),
        })
      )
    );
  };

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("profile")}</CardTitle>
        <CardDescription>{t("profile-description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <SchoolMark logo={tenant.logo} mascot={tenant.mascot} />
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="wrap-anywhere font-medium">{tenant.name}</p>
          <p className="wrap-anywhere text-muted-foreground text-sm">
            {address}
          </p>
        </div>
        <Button onClick={copyAddress} size="sm" type="button" variant="outline">
          {t("address-copy")}
        </Button>
      </CardContent>
      <CardSectionFooter>
        <CardSectionHint>{t("logo-footer")}</CardSectionHint>
        <CardSectionActions>
          <input
            accept="image/png,image/svg+xml"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                chooseLogo(file);
              }
            }}
            ref={fileInput}
            type="file"
          />
          <Button
            onClick={() => fileInput.current?.click()}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("logo-upload")}
          </Button>
          {tenant.logo === undefined ? null : (
            <Button
              onClick={() => setIsRemoving(true)}
              size="sm"
              type="button"
              variant="destructive"
            >
              {t("logo-remove")}
            </Button>
          )}
        </CardSectionActions>
      </CardSectionFooter>
      <ResponsiveDialog
        description={t("logo-remove-description")}
        footer={
          <Button onClick={takeLogoOff} type="button" variant="destructive">
            {t("logo-remove-confirm")}
          </Button>
        }
        open={isRemoving}
        setOpen={setIsRemoving}
        title={t("logo-remove-title")}
      />
    </CardSection>
  );
}
