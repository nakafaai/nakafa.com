import { Button } from "@repo/design-system/components/ui/button";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { Auth } from "@/components/auth";
import { AuthTitle } from "@/components/auth/title";
import { EntryShellBody, EntryShellHeader } from "@/components/entry/shell";
import { Theme } from "@/components/marketing/shared/footer/action";
import { BackButton } from "@/components/shared/back";
import {
  getShellPageNavigation,
  type PageNavigation,
} from "@/lib/content/page/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default async function Page(props: PageProps<"/[locale]/auth">) {
  const locale = getLocaleOrThrow((await props.params).locale);
  const pageNavigation = await getShellPageNavigation(locale);

  return (
    <>
      <EntryShellHeader>
        <BackButton />

        <Theme variant="ghost" />
      </EntryShellHeader>
      <EntryShellBody>
        <AuthTitle />

        <Auth />

        <PageFooter locale={locale} pageNavigation={pageNavigation} />
      </EntryShellBody>
    </>
  );
}

function PageFooter({
  locale,
  pageNavigation,
}: {
  locale: Locale;
  pageNavigation: PageNavigation | null;
}) {
  const tLegal = useTranslations("Legal");

  if (!pageNavigation) {
    return null;
  }

  return (
    <div className="flex max-w-sm flex-col">
      <p className="text-balance text-center text-muted-foreground text-sm">
        {tLegal.rich("legal-description", {
          "terms-of-service": (chunks) => (
            <Button
              className="h-auto p-0"
              nativeButton={false}
              render={
                <a
                  href={`/${locale}${pageNavigation.termsOfServiceHref}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {chunks}
                </a>
              }
              size="sm"
              variant="link"
            />
          ),
          "privacy-policy": (chunks) => (
            <Button
              className="h-auto p-0"
              nativeButton={false}
              render={
                <a
                  href={`/${locale}${pageNavigation.privacyPolicyHref}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {chunks}
                </a>
              }
              size="sm"
              variant="link"
            />
          ),
        })}
      </p>
    </div>
  );
}
