import { Link } from "@/i18n/routing";
import type { LucideIcon } from "lucide-react";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { GradientBlock } from "./gradient-block";

type Props = {
  icon: LucideIcon;
  label: string;
  href: string;
};

export function CardSubject({ icon: Icon, label, href }: Props) {
  return (
    <Link href={href} className="group" prefetch>
      <Card className="relative overflow-hidden">
        <CardHeader className="gap-0">
          <div className="flex items-center gap-2">
            <Icon className="size-5 shrink-0" />
            <CardTitle
              title={label}
              className="line-clamp-1 pr-9 font-medium tracking-tight"
            >
              <h2>{label}</h2>
            </CardTitle>
          </div>
        </CardHeader>
        <GradientBlock
          keyString={label}
          className="absolute inset-y-0 right-0 h-full w-3 border-l transition-all duration-500 ease-in-out group-hover:w-9"
        />
      </Card>
    </Link>
  );
}
