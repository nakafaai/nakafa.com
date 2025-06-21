"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { ArrowDownIcon, ArrowRightIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  description: ReactNode;
  machineLabel: string;
  content: {
    input: string;
    output: string;
  };
};

export function FunctionIllustration({
  title,
  description,
  machineLabel,
  content,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-8 py-8 sm:flex-row">
          <Button className="pointer-events-none">{content.input}</Button>

          <ArrowRightIcon className="hidden size-4 sm:block" />
          <ArrowDownIcon className="block size-4 sm:hidden" />

          <div className="flex items-center justify-center rounded-md bg-accent p-8 text-accent-foreground">
            {machineLabel}
          </div>

          <ArrowDownIcon className="block size-4 sm:hidden" />
          <ArrowRightIcon className="hidden size-4 sm:block" />

          <Button variant="destructive" className="pointer-events-none">
            {content.output}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
