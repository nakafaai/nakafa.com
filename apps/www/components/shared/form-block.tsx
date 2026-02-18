import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  description: ReactNode;
  footer?: ReactNode;
  title: ReactNode;
  variant?: "default" | "destructive";
}

export function FormBlock({
  title,
  footer,
  children,
  variant = "default",
  description,
}: Props) {
  return (
    <Card
      className={cn(
        "overflow-hidden",
        variant === "destructive" && "border-destructive",
        !!footer && "pb-0"
      )}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
      {!!footer && (
        <CardFooter
          className={cn(
            "border-t bg-muted/20 py-3 [.border-t]:pt-3",
            variant === "destructive" && "border-destructive bg-destructive/20"
          )}
        >
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
