"use client";

import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import NavigationLink from "../ui/navigation-link";

function getBreadcrumb(pathname: string) {
  if (pathname.includes("/subject")) {
    return "subject";
  }
  if (pathname.includes("/articles")) {
    return "articles";
  }
  if (pathname.includes("/search")) {
    return "search";
  }
  return null;
}

export function HeaderBreadcrumb() {
  const t = useTranslations("Common");

  const pathname = usePathname();
  const breadcrumb = getBreadcrumb(pathname);

  return (
    <div className="hidden items-center gap-4 lg:flex">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink asChild>
              <NavigationLink href="/" title={t("home")}>
                {t("home")}
              </NavigationLink>
            </BreadcrumbLink>
          </BreadcrumbItem>

          {breadcrumb && (
            <>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="truncate">
                  {t(breadcrumb)}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
