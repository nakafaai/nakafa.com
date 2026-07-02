import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/design-system/components/ui/breadcrumb";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Fragment } from "react";
import type { readCurriculumBreadcrumbs } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";
import { readCurriculumRouteIcon } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/icons";
import {
  CurriculumSelector,
  type CurriculumSelectorOption,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/selector";
import { choiceCardVariants } from "@/components/shared/choice-card";

type CurriculumBreadcrumbs = ReturnType<typeof readCurriculumBreadcrumbs>;

/** Renders the root curriculum header with breadcrumb context and curriculum switching. */
export function CurriculumRootHeader({
  breadcrumbs,
  currentRoute,
  locale,
  options,
  selectorLabel,
}: {
  breadcrumbs: CurriculumBreadcrumbs;
  currentRoute: PublicCurriculumRoute;
  locale: PublicCurriculumRoute["locale"];
  options: readonly CurriculumSelectorOption[];
  selectorLabel: string;
}) {
  return (
    <header className="relative py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="sr-only">{currentRoute.title}</h1>
        <CurriculumBreadcrumb items={breadcrumbs} locale={locale} />
        <CurriculumSelector
          currentValue={currentRoute.publicPath}
          label={selectorLabel}
          options={options}
        />
      </div>
    </header>
  );
}

/** Renders root curriculum child routes as linked onboarding-style cards. */
export function CurriculumRootCards({
  locale,
  routes,
}: {
  locale: PublicCurriculumRoute["locale"];
  routes: readonly PublicCurriculumRoute[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 pb-24 sm:grid-cols-2 md:grid-cols-3">
      {routes.map((route) => {
        const Icon = readCurriculumRouteIcon(route);

        return (
          <NavigationLink
            className={choiceCardVariants()}
            href={`/${locale}/${route.publicPath}`}
            key={route.publicPath}
          >
            <div className="relative flex aspect-video w-full items-center justify-center">
              <GradientBlock
                className="pointer-events-none absolute inset-0 opacity-20 [mask-image:linear-gradient(to_bottom,black_0%,black_65%,transparent_100%)] [mask-repeat:no-repeat] [mask-size:100%_100%]"
                colorScheme="vibrant"
                intensity="medium"
                keyString={route.publicPath}
              />
              <HugeIcons
                aria-hidden
                className="relative size-8 text-foreground/70"
                icon={Icon}
              />
            </div>
            <div className="px-6 pt-3 pb-6 text-center">
              <h2 className="font-medium text-lg">{route.title}</h2>
            </div>
          </NavigationLink>
        );
      })}
    </div>
  );
}

/** Renders the visible shadcn breadcrumb for a root curriculum page. */
function CurriculumBreadcrumb({
  items,
  locale,
}: {
  items: CurriculumBreadcrumbs;
  locale: PublicCurriculumRoute["locale"];
}) {
  const lastIndex = items.length - 1;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isCurrent = index === lastIndex;

          return (
            <Fragment key={item.path || "home"}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isCurrent ? (
                  <BreadcrumbPage>{item.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={readBreadcrumbHref(locale, item.path)}>
                    {item.name}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** Builds a locale-prefixed public breadcrumb href from route projection paths. */
function readBreadcrumbHref(
  locale: PublicCurriculumRoute["locale"],
  path: string
) {
  if (!path) {
    return `/${locale}`;
  }

  return `/${locale}${path}`;
}
