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
import { readCurriculumRouteIcon } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/icons";
import {
  CurriculumSelector,
  type CurriculumSelectorOption,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/selector";
import { choiceCardVariants } from "@/components/shared/choice-card";

/** Renders the root curriculum header with breadcrumb context and curriculum switching. */
export function CurriculumRootHeader({
  currentRoute,
  homeLabel,
  locale,
  options,
  selectorLabel,
  subjectLabel,
}: {
  currentRoute: PublicCurriculumRoute;
  homeLabel: string;
  locale: PublicCurriculumRoute["locale"];
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
          locale={locale}
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
    <div className="grid grid-cols-1 gap-4 pt-6 pb-24 md:grid-cols-3">
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
                className="mask-[linear-gradient(to_bottom,black_0%,black_65%,transparent_100%)] mask-no-repeat mask-size-[100%_100%] pointer-events-none absolute inset-0 opacity-20"
                colorScheme="vibrant"
                intensity="medium"
                keyString={route.publicPath}
              />
              <HugeIcons
                aria-hidden
                className="relative size-6 text-foreground"
                icon={Icon}
              />
            </div>
            <div className="px-6 pt-3 pb-6 text-center">
              <h2>{route.title}</h2>
            </div>
          </NavigationLink>
        );
      })}
    </div>
  );
}

/** Renders the visible shadcn breadcrumb for a root curriculum page. */
function CurriculumBreadcrumb({
  homeLabel,
  locale,
  subjectLabel,
}: {
  homeLabel: string;
  locale: PublicCurriculumRoute["locale"];
  subjectLabel: string;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/${locale}`}>{homeLabel}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{subjectLabel}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
