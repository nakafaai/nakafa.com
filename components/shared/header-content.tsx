import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, type LucideIcon, UserPenIcon } from "lucide-react";
import { buttonVariants } from "../ui/button";
import { Particles } from "../ui/particles";

type Props = {
  /** The title of the content */
  title: string;
  /** The link to go some where, it will be shown as a button on top of the title */
  link?: {
    href: string;
    label: string;
  };
  /** The description of the content */
  description?: string;
  /** The icon of the title */
  icon?: LucideIcon;
  /** The category of the content */
  category?: {
    icon: LucideIcon;
    name: string;
  };
  /** The authors of the content */
  authors?: {
    name: string;
  }[];
  /** The date of the content creation */
  date?: string;
};

export function HeaderContent({
  title,
  link,
  description,
  icon: Icon,
  category,
  authors,
  date,
}: Props) {
  const showFooter = authors || date;
  return (
    <div className="relative border-b py-10">
      <Particles
        quantity={25}
        className="pointer-events-none absolute inset-0 opacity-80"
      />
      <div className="z-10 mx-auto max-w-3xl space-y-4 px-6">
        <div className="space-y-2">
          {link && (
            <Link
              href={link.href}
              className={cn(buttonVariants({ variant: "link" }), "h-auto p-0")}
              aria-label={link.label}
              prefetch
            >
              {link.label}
            </Link>
          )}
          <div className="flex items-center gap-2">
            {Icon && <Icon className="size-7" />}
            <h1
              id={title.toLowerCase().replace(/ /g, "-")}
              className="font-medium text-3xl leading-tight tracking-tight"
            >
              {title}
            </h1>
          </div>
        </div>
        {description && <p className="text-foreground/80">{description}</p>}
        {showFooter && (
          <div
            data-pagefind-ignore
            className="flex flex-col justify-between gap-2 pt-2 sm:flex-row sm:items-center sm:gap-4"
          >
            {authors && (
              <p className="inline-flex items-center gap-1 text-muted-foreground">
                <UserPenIcon className="size-4 shrink-0" />
                <span className="text-sm">
                  {authors.map((author) => author.name).join(", ")}
                </span>
              </p>
            )}

            <div className="flex items-center gap-4">
              {date && (
                <p className="inline-flex items-center gap-1 text-muted-foreground">
                  <CalendarIcon className="size-4 shrink-0" />
                  <span className="text-sm">
                    {format(new Date(date), "d MMM, yyyy")}
                  </span>
                </p>
              )}

              {category && (
                <p className="inline-flex items-center gap-1 text-muted-foreground">
                  <category.icon className="size-4 shrink-0" />
                  <span className="text-sm">{category.name}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
