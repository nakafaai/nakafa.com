"use client";

import { Button as UIButton } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Button,
  Group,
  Input,
  Label,
  NumberField,
} from "react-aria-components";
import { InlineMath } from "react-katex";

type Props = {
  title: string;
  description: string;
};

export function FunctionAnalogy({ title, description }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <Machine />
    </Card>
  );
}

function Machine() {
  const [input, setInput] = useState<number>(5);

  const output = useMemo(() => {
    // y = 2x + 1
    return 2 * input + 1;
  }, [input]);

  return (
    <>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-8 py-8 sm:flex-row">
          <UIButton className="pointer-events-none">
            <InlineMath math={`x = ${input}`} />
          </UIButton>

          <ArrowRightIcon className="hidden size-4 sm:block" />
          <ArrowDownIcon className="block size-4 sm:hidden" />

          <div className="flex items-center justify-center rounded-md bg-accent p-8 text-accent-foreground shadow-xs">
            <InlineMath math="f(x) = 2x + 1" />
          </div>

          <ArrowDownIcon className="block size-4 sm:hidden" />
          <ArrowRightIcon className="hidden size-4 sm:block" />

          <UIButton variant="destructive" className="pointer-events-none">
            <InlineMath math={`f(x) = ${output}`} />
          </UIButton>
        </div>
      </CardContent>
      <CardFooter className="justify-center border-t">
        <NumberField
          value={input}
          onChange={setInput}
          formatOptions={{
            localeMatcher: "best fit",
          }}
        >
          <Label className="sr-only">Machine function</Label>
          <Group className="relative inline-flex h-9 w-full items-center overflow-hidden whitespace-nowrap rounded-md border border-input text-sm shadow-xs outline-none transition-[color,box-shadow] data-focus-within:border-ring data-disabled:opacity-50 data-focus-within:ring-[3px] data-focus-within:ring-ring/50 data-focus-within:has-aria-invalid:border-destructive data-focus-within:has-aria-invalid:ring-destructive/20 dark:data-focus-within:has-aria-invalid:ring-destructive/40">
            <Button
              slot="decrement"
              className="-ms-px flex aspect-square h-[inherit] cursor-pointer items-center justify-center rounded-s-md border border-input bg-background text-muted-foreground/80 text-sm transition-[color,box-shadow] hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MinusIcon className="size-4" aria-hidden="true" />
            </Button>
            <Input className="w-full grow bg-background px-3 py-2 text-center font-mono text-foreground tabular-nums" />
            <Button
              slot="increment"
              className="-me-px flex aspect-square h-[inherit] cursor-pointer items-center justify-center rounded-e-md border border-input bg-background text-muted-foreground/80 text-sm transition-[color,box-shadow] hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusIcon className="size-4" aria-hidden="true" />
            </Button>
          </Group>
        </NumberField>
      </CardFooter>
    </>
  );
}
