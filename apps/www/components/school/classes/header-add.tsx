"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/design-system/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { cn } from "@repo/design-system/lib/utils";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  PlusIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import * as z from "zod/mini";
import { useSchool } from "@/lib/context/use-school";
import { subjectList } from "./_data/subject";

const MIN_NAME_LENGTH = 3;

const formSchema = z.object({
  name: z.string().check(z.minLength(MIN_NAME_LENGTH), z.trim()),
  subject: z.string().check(z.minLength(MIN_NAME_LENGTH), z.trim()),
  year: z.string().check(z.minLength(MIN_NAME_LENGTH), z.trim()),
});

export function SchoolClassesHeaderAdd() {
  const t = useTranslations("School.Classes");

  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [subjectPopoverOpen, setSubjectPopoverOpen] = useState(false);

  const schoolId = useSchool((s) => s.school._id);
  const createClass = useMutation(api.classes.mutations.createClass);

  const form = useForm({
    defaultValues: {
      name: "",
      subject: "",
      year: getCurrentAcademicYear(),
    },
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const classId = await createClass({
          ...value,
          schoolId,
        });
        router.push(`${pathname}/${classId}`);
        setOpen(false);
        form.reset();
      } catch {
        toast.error(t("create-class-failed"));
      }
    },
  });

  return (
    <form
      id="school-classes-header-add-form"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <ButtonGroup>
        <Button onClick={() => setOpen(true)}>
          <PlusIcon />
          <span className="hidden sm:inline">{t("create-class")}</span>
        </Button>
      </ButtonGroup>

      <ResponsiveDialog
        description={t("create-class-description")}
        footer={
          <form.Subscribe
            selector={(state) => [state.isValid, state.isSubmitting]}
          >
            {([isValid, isSubmitting]) => (
              <Button
                disabled={!isValid || isSubmitting}
                form="school-classes-header-add-form"
                type="submit"
              >
                {isSubmitting ? <SpinnerIcon /> : <PlusIcon />}
                {t("create")}
              </Button>
            )}
          </form.Subscribe>
        }
        open={open}
        setOpen={setOpen}
        title={t("create-class")}
      >
        <FieldGroup>
          <form.Field name="name">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="school-classes-header-add-name">
                    {t("name-label")}
                  </FieldLabel>
                  <Input
                    aria-invalid={isInvalid}
                    id="school-classes-header-add-name"
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t("name-placeholder")}
                    value={field.state.value}
                  />
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="subject">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="school-classes-header-add-subject">
                    {t("subject-label")}
                  </FieldLabel>
                  <ButtonGroup>
                    <Input
                      aria-invalid={isInvalid}
                      id="school-classes-header-add-subject"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t("subject-placeholder")}
                      value={field.state.value}
                    />

                    <Popover
                      onOpenChange={setSubjectPopoverOpen}
                      open={subjectPopoverOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button aria-label="Select subject" variant="outline">
                          <ChevronDownIcon
                            className={cn(
                              "transition-transform ease-out",
                              !!subjectPopoverOpen && "rotate-180"
                            )}
                          />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="p-0">
                        <Command>
                          <CommandInput
                            placeholder={t("search-subjects-placeholder")}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {t("no-subjects-found")}
                            </CommandEmpty>
                            <CommandGroup>
                              {subjectList.map((subject) => (
                                <CommandItem
                                  className="cursor-pointer"
                                  key={subject}
                                  onSelect={() => {
                                    field.handleChange(t(subject));
                                    setSubjectPopoverOpen(false);
                                  }}
                                >
                                  <span>{t(subject)}</span>
                                  <CheckIcon
                                    className={cn(
                                      "ml-auto size-4 opacity-0 transition-opacity ease-out",
                                      field.state.value === t(subject) &&
                                        "opacity-100"
                                    )}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </ButtonGroup>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="year">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="school-classes-header-add-year">
                    {t("year-label")}
                  </FieldLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-invalid={isInvalid}
                        className="w-full font-normal"
                        id="school-classes-header-add-year"
                        name={field.name}
                        variant="outline"
                      >
                        <CalendarIcon />
                        {field.state.value || t("year-placeholder")}
                        <ChevronDownIcon className="ml-auto" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-(--radix-dropdown-menu-trigger-width)"
                    >
                      {getAcademicYearList().map((year) => (
                        <DropdownMenuItem
                          className="cursor-pointer"
                          key={year}
                          onSelect={() => field.handleChange(year)}
                        >
                          {year}
                          <CheckIcon
                            className={cn(
                              "ml-auto size-4 opacity-0 transition-opacity ease-out",
                              field.state.value === year && "opacity-100"
                            )}
                          />
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Field>
              );
            }}
          </form.Field>
        </FieldGroup>
      </ResponsiveDialog>
    </form>
  );
}

function getCurrentAcademicYear() {
  const date = new Date();
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth();

  // Academic year starts in July (month index 6)
  const startYear = currentMonth >= 6 ? currentYear : currentYear - 1;
  return `${startYear}/${startYear + 1}`;
}

function getAcademicYearList() {
  const date = new Date();
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth();

  // Academic year starts in July (month index 6)
  const startYear = currentMonth >= 6 ? currentYear : currentYear - 1;

  // Return 2 previous years, current year, and next 2 years
  return Array.from({ length: 5 }, (_, i) => {
    const year = startYear - 2 + i;
    return `${year}/${year + 1}`;
  });
}
