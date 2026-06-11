import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import NavigationLink from "@repo/design-system/components/navigation/link";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
import { Particles } from "@repo/design-system/components/visual/particles";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

interface EventAccessLayoutProps {
  children: ReactNode;
}

interface EventAccessCardProps {
  action: ReactNode;
  description: ReactNode;
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
            <NavigationLink href="/home">
              <HugeIcons icon={ArrowLeft02Icon} />
              {tCommon("home")}
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
  description,
  title,
}: EventAccessCardProps) {
  return (
    <Frame>
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FrameFooter>{action}</FrameFooter>
    </Frame>
  );
}
