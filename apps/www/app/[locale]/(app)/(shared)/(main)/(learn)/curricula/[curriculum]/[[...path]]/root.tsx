import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/design-system/components/ui/breadcrumb";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { Locale } from "next-intl";
import { readCurriculumRouteIcon } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/icons";
import type {
  CurriculumCatalogEntry,
  CurriculumViewRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/runtime";
import {
  CurriculumSelector,
  type CurriculumSelectorOption,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/selector";
import {
  CatalogCard,
  CatalogCardGradient,
  CatalogCardImage,
} from "@/components/shared/catalog/card";
import { ChoiceCardIcon } from "@/components/shared/choice/visual";
import { resolveCurriculumCatalogArtwork } from "@/lib/curriculum/artwork";

/** Renders the curriculum index header with breadcrumb context. */
export function CurriculumIndexHeader({
  homeLabel,
  title,
}: {
  homeLabel: string;
  title: string;
}) {
  return (
    <header className="sticky top-16 z-10 flex min-h-16 w-full shrink-0 border-b bg-background lg:top-0">
      <div className="mx-auto flex w-full max-w-3xl items-center px-6 py-3 sm:py-0">
        <h1 className="sr-only">{title}</h1>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                render={
                  <NavigationLink href="/home">{homeLabel}</NavigationLink>
                }
              />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}

/** Renders the root curriculum header with breadcrumb context and curriculum switching. */
export function CurriculumRootHeader({
  currentRoute,
  homeLabel,
  options,
  selectorLabel,
  subjectLabel,
}: {
  currentRoute: CurriculumViewRoute;
  homeLabel: string;
  options: readonly CurriculumSelectorOption[];
  selectorLabel: string;
  subjectLabel: string;
}) {
  return (
    <header className="sticky top-16 z-10 flex min-h-16 w-full shrink-0 border-b bg-background lg:top-0">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <h1 className="sr-only">{currentRoute.title}</h1>
        <CurriculumBreadcrumb
          homeLabel={homeLabel}
          subjectLabel={subjectLabel}
        />
        <CurriculumSelector
          currentValue={currentRoute.publicPath}
          label={selectorLabel}
          options={options}
        />
      </div>
    </header>
  );
}

/** Renders the public Curriculum index as image cards with explicit actions. */
export function CurriculumCatalogCards({
  actionLabel,
  entries,
  locale,
}: {
  actionLabel: string;
  entries: readonly CurriculumCatalogEntry[];
  locale: Locale;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
      {entries.map(({ program, route }, index) => {
        const imageSrc = resolveCurriculumCatalogArtwork(locale, {
          kind: "program",
          programKey: program.key,
        });

        return (
          <CatalogCard
            action={<NavigationLink href={`/${locale}/${route.publicPath}`} />}
            actionLabel={actionLabel}
            key={route.publicPath}
            title={route.title}
          >
            {imageSrc ? (
              <CatalogCardImage preload={index === 0} src={imageSrc} />
            ) : (
              <CatalogCardGradient seed={route.nodeKey}>
                <ChoiceCardIcon icon={readCurriculumRouteIcon(route)} />
              </CatalogCardGradient>
            )}
          </CatalogCard>
        );
      })}
    </div>
  );
}

/** Renders curriculum child routes with reviewed art or an identity gradient. */
export function CurriculumChildCards({
  actionLabel,
  locale,
  routes,
}: {
  actionLabel: string;
  locale: Locale;
  routes: readonly CurriculumViewRoute[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
      {routes.map((route, index) => {
        const imageSrc = resolveCurriculumCatalogArtwork(locale, {
          iconKey: route.iconKey,
          kind: "route",
          materialDomain: route.materialDomain,
        });

        return (
          <CatalogCard
            action={<NavigationLink href={`/${locale}/${route.publicPath}`} />}
            actionLabel={actionLabel}
            key={route.publicPath}
            title={route.title}
          >
            {imageSrc ? (
              <CatalogCardImage preload={index === 0} src={imageSrc} />
            ) : (
              <CatalogCardGradient seed={route.nodeKey}>
                <ChoiceCardIcon icon={readCurriculumRouteIcon(route)} />
              </CatalogCardGradient>
            )}
          </CatalogCard>
        );
      })}
    </div>
  );
}

/** Renders the visible shadcn breadcrumb for a root curriculum page. */
function CurriculumBreadcrumb({
  homeLabel,
  subjectLabel,
}: {
  homeLabel: string;
  subjectLabel: string;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            render={<NavigationLink href="/home">{homeLabel}</NavigationLink>}
          />
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{subjectLabel}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
