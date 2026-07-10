import { findLearningProgramByKey } from "@repo/contents/_types/program/catalog";
import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/design-system/components/ui/breadcrumb";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { readCurriculumRouteIcon } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/icons";
import {
  CurriculumSelector,
  type CurriculumSelectorOption,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/selector";
import { ChoiceCardContent } from "@/components/shared/choice/card";
import { choiceCardVariants } from "@/components/shared/choice/variants";
import {
  ChoiceCardIcon,
  ChoiceCardVisual,
} from "@/components/shared/choice/visual";
import { CountryFlagIcon } from "@/components/shared/country-flag";

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
  currentRoute: PublicCurriculumRoute;
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

/** Renders root curriculum child routes as linked onboarding-style cards. */
export function CurriculumRootCards({
  locale,
  routes,
}: {
  locale: PublicCurriculumRoute["locale"];
  routes: readonly PublicCurriculumRoute[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 pt-6 pb-24 md:grid-cols-3">
      {routes.map((route) => {
        const Icon = readCurriculumRouteIcon(route);
        const program = findLearningProgramByKey(route.programKey);
        const countryCode =
          route.level === "track" ? program?.provider.homeCountry : undefined;

        return (
          <NavigationLink
            className={choiceCardVariants()}
            href={`/${locale}/${route.publicPath}`}
            key={route.publicPath}
          >
            <ChoiceCardVisual seed={route.publicPath}>
              {countryCode ? (
                <CountryFlagIcon
                  className="relative h-6 w-9 rounded-[2px] ring-1 ring-border/60"
                  countryCode={countryCode}
                />
              ) : (
                <ChoiceCardIcon icon={Icon} />
              )}
            </ChoiceCardVisual>
            <ChoiceCardContent>
              <h2>{route.title}</h2>
            </ChoiceCardContent>
          </NavigationLink>
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
