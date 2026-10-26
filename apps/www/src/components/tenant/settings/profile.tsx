import { QueryResult, useMutation } from "@confect/react";
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
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { MAIN_DOMAIN } from "@repo/site/domains";
import { Effect, Schema } from "effect";
import { startTransition, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { logoRefusalOf } from "@/components/tenant/logo";
import { SchoolMark } from "@/components/tenant/mark";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { removeLogoChange } from "@/components/tenant/settings/mutation";
import { SchoolNameCard } from "@/components/tenant/settings/name";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsPage } from "@/components/tenant/settings/section";
import { storeSchoolLogo } from "@/components/tenant/settings/upload";
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

/** The section in the settings page frame, whose header shows while its body loads. */
export function SchoolProfileSettings({ slug }: { slug: TenantSlug }) {
  return (
    <SettingsPage>
      <ReadBoundary read={{ args: { slug }, ref: tenancy.viewer.get }}>
        <SchoolProfileBody />
      </ReadBoundary>
    </SettingsPage>
  );
}

/**
 * Renders the profile of the school: its logo, and its address with a copy action.
 * The settings pages read the school on the client, so a logo that changes shows
 * at once.
 */
function SchoolProfileBody() {
  const viewer = useViewerQuery();

  if (QueryResult.isFailure(viewer)) {
    throw viewer.error;
  }
  if (!QueryResult.isSuccess(viewer)) {
    return null;
  }

  return <SchoolProfileCard tenant={viewer.value.tenant} />;
}

/** Renders the name card, the logo card and the address card, each with its action in the footer. */
function SchoolProfileCard({
  tenant,
}: {
  tenant: {
    readonly logo?: string | undefined;
    readonly mascot: Parameters<typeof SchoolMark>[0]["mascot"];
    readonly name: string;
  };
}) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const fileInput = useRef<HTMLInputElement>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(undefined);
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
    // The chosen image shows at once while it uploads. When the server answers, saved or refused,
    // the preview steps back, and the logo the server holds shows instead.
    const url = URL.createObjectURL(file);
    setPreview(url);
    startTransition(async () => {
      await saveSchool(
        () =>
          storeSchoolLogo({
            file,
            requestUrl: () => requestUrl({ slug }),
            save: (storageId) => setLogo({ contentType, slug, storageId }),
          }),
        SOURCE
      );
      setPreview(undefined);
      URL.revokeObjectURL(url);
    });
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
    <>
      <SchoolNameCard name={tenant.name} slug={slug} />
      <CardSection>
        <CardHeader>
          <CardTitle>{t("logo-title")}</CardTitle>
          <CardDescription>{t("logo-description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SchoolMark
            logo={preview ?? tenant.logo}
            mascot={tenant.mascot}
            size="lg"
          />
        </CardContent>
        <CardSectionFooter hint={t("logo-footer")}>
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
            <Button
              onClick={() => fileInput.current?.click()}
              size="sm"
              type="button"
            >
              {t("logo-upload")}
            </Button>
          </CardSectionActions>
        </CardSectionFooter>
        <ResponsiveDialog
          description={t("logo-remove-description")}
          footer={
            <>
              <Button
                onClick={() => setIsRemoving(false)}
                type="button"
                variant="outline"
              >
                {common("cancel")}
              </Button>
              <Button onClick={takeLogoOff} type="button" variant="destructive">
                {t("logo-remove-confirm")}
              </Button>
            </>
          }
          open={isRemoving}
          setOpen={setIsRemoving}
          title={t("logo-remove-title")}
        />
      </CardSection>
      <CardSection>
        <CardHeader>
          <CardTitle>{t("address-title")}</CardTitle>
          <CardDescription>{t("address-description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            aria-label={t("address-title")}
            className="max-w-sm"
            readOnly
            value={address}
          />
        </CardContent>
        <CardSectionFooter hint={t("address-footer")}>
          <CardSectionActions>
            <Button onClick={copyAddress} size="sm" type="button">
              {t("address-copy")}
            </Button>
          </CardSectionActions>
        </CardSectionFooter>
      </CardSection>
    </>
  );
}
