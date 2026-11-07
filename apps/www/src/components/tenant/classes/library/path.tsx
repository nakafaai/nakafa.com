import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/design-system/components/ui/breadcrumb";
import { Array as Arr } from "effect";
import { Fragment } from "react";
import { useTranslations } from "use-intl";
import type { LibraryFolder } from "@/components/tenant/classes/library/folder";
import { useClassScope } from "@/components/tenant/classes/scope";
import { Link } from "@/lib/routing/link";
import {
  schoolClassFolderTarget,
  schoolClassLibraryTarget,
} from "@/lib/routing/school/target";

/** The path from the top of the library to the folder the page shows, each step a link but the last. */
export function LibraryPath({
  folders,
}: {
  folders: readonly LibraryFolder[];
}) {
  const t = useTranslations("Classroom");
  const { classSlug, slug } = useClassScope();

  return (
    <Breadcrumb aria-label={t("library-path")}>
      <BreadcrumbList>
        <BreadcrumbItem>
          {Arr.isReadonlyArrayEmpty(folders) ? (
            <BreadcrumbPage>{t("library-top")}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink
              render={<Link {...schoolClassLibraryTarget(slug, classSlug)} />}
            >
              {t("library-top")}
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {Arr.map(folders, (folder, index) => (
          <Fragment key={folder.id}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {index === folders.length - 1 ? (
                <BreadcrumbPage dir="auto">{folder.name}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  render={
                    <Link
                      {...schoolClassFolderTarget(slug, classSlug, folder.id)}
                    />
                  }
                >
                  <span dir="auto">{folder.name}</span>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
