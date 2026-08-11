import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/design-system/components/ui/breadcrumb";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import Image from "next/image";
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
import { ChoiceCardContent } from "@/components/shared/choice/card";
import { choiceCardVariants } from "@/components/shared/choice/variants";
import {
  ChoiceCardIcon,
  ChoiceCardVisual,
} from "@/components/shared/choice/visual";
import { getCurriculumRouteSocialImage } from "@/lib/curriculum/social-images";

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
      {entries.map(({ program, route }, index) => (
        <Card
          className="relative mx-auto h-full w-full max-w-sm pt-0 pb-0 [--card-spacing:--spacing(4)]"
          key={route.publicPath}
        >
          <Image
            alt=""
            className="h-auto w-full"
            height={630}
            preload={index === 0}
            sizes="(min-width: 640px) 384px, calc(100vw - 48px)"
            src={getCurriculumRouteSocialImage(locale, program.key, route)}
            width={1200}
          />
          <CardHeader className="flex-1">
            <CardTitle>
              <h2>{route.title}</h2>
            </CardTitle>
          </CardHeader>
          <CardFooter className="border-t bg-muted/50 p-(--card-spacing)">
            <Button
              className="w-full"
              render={
                <NavigationLink
                  aria-label={`${actionLabel} ${route.title}`}
                  href={`/${locale}/${route.publicPath}`}
                />
              }
            >
              {actionLabel}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

/** Renders curriculum child routes with the established choice-card surface. */
export function CurriculumChildCards({
  locale,
  routes,
}: {
  locale: Locale;
  routes: readonly CurriculumViewRoute[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 pt-6 pb-24 md:grid-cols-3">
      {routes.map((route) => {
        const Icon = readCurriculumRouteIcon(route);

        return (
          <NavigationLink
            className={choiceCardVariants()}
            href={`/${locale}/${route.publicPath}`}
            key={route.publicPath}
          >
            <ChoiceCardVisual seed={route.publicPath}>
              <ChoiceCardIcon icon={Icon} />
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
