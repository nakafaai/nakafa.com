import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Particles } from "@repo/design-system/components/ui/particles";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

interface EventAccessLayoutProps {
  children: ReactNode;
}

interface EventAccessCardProps {
  action?: ReactNode;
  badge: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}

export function EventAccessLayout({ children }: EventAccessLayoutProps) {
  const tCommon = useTranslations("Common");

  return (
    <main className="relative flex h-[calc(100svh-4rem)] items-center justify-center">
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="z-1 m-auto w-full max-w-xl space-y-3 px-6 py-12">
        <Button
          render={
            <NavigationLink href="/try-out">
              <HugeIcons icon={ArrowLeft02Icon} />
              {tCommon("back")}
            </NavigationLink>
          }
          variant="link"
        />

        {children}
      </div>
    </main>
  );
}

export function EventAccessCard({
  action,
  badge,
  description,
  title,
}: EventAccessCardProps) {
  return (
    <Card>
      <CardHeader>
        <Badge variant="secondary">{badge}</Badge>
        <CardTitle>{title}</CardTitle>
      </CardHeader>

      {description ? (
        <CardContent>
          <CardDescription>{description}</CardDescription>
        </CardContent>
      ) : null}

      {action ? <CardFooter>{action}</CardFooter> : null}
    </Card>
  );
}
