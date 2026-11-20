import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { RichTextSchema } from "@nakafa/aksara-contracts/assessment/inline";
import { Button } from "@repo/design-system/components/ui/button";
import {
  FieldLabel,
  FieldLegend,
  FieldSet,
  Field as FormField,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useRequired } from "@repo/design-system/hooks/required";
import { Array as Arr, Match, Option, Schema } from "effect";
import type { ReactNode } from "react";
import { createContext, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { placeNodes } from "@/components/assessment/place";
import type { Field, StepSchema } from "@/components/tenant/exams/figure/form";
import {
  getAt,
  initialCase,
  initialValue,
  labelOf,
  richOfText,
  textOfRich,
} from "@/components/tenant/exams/figure/form";

/** The props being written and the one way to change them, which every control of the form reads. */
const FigurePropsContext = createContext<{
  readonly props: unknown;
  readonly write: (
    path: readonly (typeof StepSchema.Type)[],
    value: unknown
  ) => void;
} | null>(null);

/** Gives the figure fields inside it the props being written and the one way to change them. */
export function FigurePropsProvider({
  children,
  props,
  write,
}: {
  readonly children: ReactNode;
  readonly props: unknown;
  readonly write: (
    path: readonly (typeof StepSchema.Type)[],
    value: unknown
  ) => void;
}) {
  return (
    <FigurePropsContext value={{ props, write }}>{children}</FigurePropsContext>
  );
}

/** Reads the props being written; a control outside the form has none to read. */
function useFigureProps() {
  return useRequired(FigurePropsContext, "useFigureProps");
}

/** A JSON value written as text, and read back from text. */
const JsonText = Schema.fromJsonString(Schema.Json);

/** A number written as text, read with either decimal point. */
const NumberText = Schema.FiniteFromString;

/**
 * One prop of a figure, edited by the control its catalog schema calls for. A prop a figure may leave
 * out is added and removed with a button, so the props hold only what the teacher wrote.
 */
export function FigureField({
  field,
  name,
  optional,
  path,
}: {
  readonly field: Field;
  readonly name: string;
  readonly optional: boolean;
  readonly path: readonly (typeof StepSchema.Type)[];
}) {
  const t = useTranslations("Exams");
  const { props, write } = useFigureProps();
  const present = getAt(props, path) !== undefined || field.kind === "rich";

  if (optional && !present) {
    return (
      <Button
        className="justify-self-start"
        onClick={() => write(path, initialValue(field))}
        size="sm"
        type="button"
        variant="outline"
      >
        <HugeIcons aria-hidden="true" icon={Add01Icon} />
        {t("figure-add", { name: labelOf(name) })}
      </Button>
    );
  }
  return field.kind === "group" ? (
    <FieldSet>
      <FieldLegend>{labelOf(name)}</FieldLegend>
      {Arr.map(field.props, (prop) => (
        <FigureField
          field={prop.field}
          key={prop.name}
          name={prop.name}
          optional={prop.optional}
          path={[...path, prop.name]}
        />
      ))}
    </FieldSet>
  ) : (
    <FieldControl field={field} name={name} path={path} />
  );
}

/** A prop that is no group: its label, its control by the kind of its field, and a line on how to write it. */
function FieldControl({
  field,
  name,
  path,
}: {
  readonly field: Field;
  readonly name: string;
  readonly path: readonly (typeof StepSchema.Type)[];
}) {
  const common = useTranslations("Common");
  const id = useId();
  const { props, write } = useFigureProps();
  const value = getAt(props, path);

  return (
    <FormField>
      <FieldLabel htmlFor={id}>{labelOf(name)}</FieldLabel>
      {Match.value(field).pipe(
        Match.discriminatorsExhaustive("kind")({
          boolean: () => (
            <Switch
              checked={value === true}
              id={id}
              onCheckedChange={(checked) => write(path, checked)}
            />
          ),
          choice: ({ options }) => (
            <Select
              items={Arr.map(options, (option) => ({
                label: String(option),
                value: option,
              }))}
              onValueChange={(next) => write(path, next)}
              value={value}
            >
              <SelectTrigger className="w-full" id={id}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent label={common("menu-kind")}>
                {Arr.map(options, (option) => (
                  <SelectItem key={String(option)} plain value={option}>
                    {String(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ),
          group: () => <JsonInput id={id} path={path} />,
          json: () => <JsonInput id={id} path={path} />,
          list: ({ item }) => <ListInput item={item} path={path} />,
          number: () => <NumberInput id={id} path={path} />,
          rich: () => (
            <Input
              dir="auto"
              id={id}
              onChange={(event) => write(path, richOfText(event.target.value))}
              placeholder={labelOf(name)}
              value={textOfRich(isRichText(value) ? value : undefined)}
            />
          ),
          text: () => (
            <Input
              dir="auto"
              id={id}
              onChange={(event) => write(path, event.target.value)}
              placeholder={labelOf(name)}
              value={typeof value === "string" ? value : ""}
            />
          ),
          variant: (variant) => (
            <VariantInput field={variant} id={id} path={path} />
          ),
        })
      )}
    </FormField>
  );
}

/** Checks whether a prop holds rich text: the inline nodes of a document. */
const isRichText = Schema.is(RichTextSchema);

/** A number, kept as typed while it reads as none, so the schema names what is wrong. */
function NumberInput({
  id,
  path,
}: {
  readonly id: string;
  readonly path: readonly (typeof StepSchema.Type)[];
}) {
  const { props, write } = useFigureProps();
  const value = getAt(props, path);

  return (
    <Input
      id={id}
      inputMode="decimal"
      onChange={(event) =>
        write(
          path,
          Option.getOrElse(
            Schema.decodeOption(NumberText)(
              event.target.value.replace(",", ".")
            ),
            () => event.target.value
          )
        )
      }
      placeholder="0"
      value={value === undefined ? "" : String(value)}
    />
  );
}

/** A list: each item with its own control and a button that removes it, and one that adds another. */
function ListInput({
  item,
  path,
}: {
  readonly item: Field;
  readonly path: readonly (typeof StepSchema.Type)[];
}) {
  const t = useTranslations("Exams");
  const { props, write } = useFigureProps();
  const value = getAt(props, path);
  const items: readonly unknown[] = Arr.isArray(value) ? value : [];

  return (
    <div className="grid gap-3">
      {Arr.map(placeNodes(items), ({ key }, index) => (
        <div className="grid gap-2 rounded-md border p-3" key={key}>
          <FigureField
            field={item}
            name={String(index + 1)}
            optional={false}
            path={[...path, index]}
          />
          <Button
            className="justify-self-end"
            onClick={() => write(path, Arr.remove(items, index))}
            size="icon-sm"
            tooltip={t("figure-remove-item")}
            type="button"
            variant="outline"
          >
            <HugeIcons aria-hidden="true" icon={Delete02Icon} />
          </Button>
        </div>
      ))}
      <Button
        className="justify-self-start"
        onClick={() => write(path, Arr.append(items, initialValue(item)))}
        size="sm"
        type="button"
        variant="outline"
      >
        <HugeIcons aria-hidden="true" icon={Add01Icon} />
        {t("figure-add-item")}
      </Button>
    </div>
  );
}

/** One of several shapes: the shape it takes, then the props of that shape. */
function VariantInput({
  field,
  id,
  path,
}: {
  readonly field: Extract<Field, { readonly kind: "variant" }>;
  readonly id: string;
  readonly path: readonly (typeof StepSchema.Type)[];
}) {
  const common = useTranslations("Common");
  const { props, write } = useFigureProps();
  const tag = getAt(props, [...path, field.tag]);
  const shape = Arr.findFirst(field.cases, ({ value }) => value === tag);

  return (
    <div className="grid gap-3">
      <Select
        items={Arr.map(field.cases, ({ value }) => ({
          label: String(value),
          value,
        }))}
        onValueChange={(next) =>
          write(
            path,
            initialCase(
              field,
              Arr.findFirstIndex(
                field.cases,
                ({ value }) => value === next
              ).pipe(Option.getOrElse(() => 0))
            )
          )
        }
        value={tag}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent label={common("menu-type")}>
          {Arr.map(field.cases, ({ value }) => (
            <SelectItem key={String(value)} plain value={value}>
              {String(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {Option.match(shape, {
        onNone: () => null,
        onSome: ({ group }) =>
          Arr.map(
            Arr.filter(group.props, (prop) => prop.name !== field.tag),
            (prop) => (
              <FigureField
                field={prop.field}
                key={prop.name}
                name={prop.name}
                optional={prop.optional}
                path={[...path, prop.name]}
              />
            )
          ),
      })}
    </div>
  );
}

/** A shape no control fits, written as JSON; text that is no JSON stays here until it is. */
function JsonInput({
  id,
  path,
}: {
  readonly id: string;
  readonly path: readonly (typeof StepSchema.Type)[];
}) {
  const { props, write } = useFigureProps();
  const [text, setText] = useState(() =>
    Option.getOrElse(
      Schema.encodeUnknownOption(JsonText)(getAt(props, path) ?? null),
      () => ""
    )
  );

  return (
    <Textarea
      className="font-mono"
      dir="ltr"
      id={id}
      onChange={(event) => {
        setText(event.target.value);
        Option.map(Schema.decodeOption(JsonText)(event.target.value), (value) =>
          write(path, value)
        );
      }}
      placeholder="{}"
      value={text}
    />
  );
}
