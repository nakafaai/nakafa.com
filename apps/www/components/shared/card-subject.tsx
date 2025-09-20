import {
  Card,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Link } from "@repo/internationalization/src/navigation";
import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  label: string;
  href: string;
};

export function CardSubject({ icon: Icon, label, href }: Props) {
  return (
    <Link className="group" href={href} prefetch title={label}>
      <Card className="relative overflow-hidden">
        <CardHeader className="gap-0">
          <div className="flex items-center gap-2">
            <Icon className="size-5 shrink-0" />
            <CardTitle
              className="line-clamp-1 pr-9 font-medium tracking-tight"
              title={label}
            >
              <h2>{label}</h2>
            </CardTitle>
          </div>
        </CardHeader>
        <div className="absolute inset-y-0 right-0 h-full w-0 bg-primary transition-[width] duration-500 ease-out group-hover:w-8" />
      </Card>
    </Link>
  );
}
