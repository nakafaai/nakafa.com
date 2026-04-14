"use client";

import {
  ArrowDown01Icon,
  Calendar03Icon,
  Tick01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { captureException } from "@repo/analytics/posthog";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
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
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useSchool } from "@/lib/context/use-school";
import { subjectList } from "./_data/subject";
import {
  classCreateDefaultValues,
  classCreateFormSchema,
  classVisibilityList,
} from "./header-add-schema";
import { getAcademicYearList } from "./header-add-utils";

/** Render the school class creation dialog. */
export function CreateSchoolClassDialog({
  open,
  setOpenAction,
}: {
  open: boolean;
  setOpenAction: (open: boolean) => void;
}) {
  const t = useTranslations("School.Classes");
  const router = useRouter();
  const pathname = usePathname();
  const schoolId = useSchool((state) => state.school._id);
  const createClass = useMutation(api.classes.mutations.createClass);
  const [subjectPopoverOpen, setSubjectPopoverOpen] = useState(false);

  const form = useForm({
    defaultValues: classCreateDefaultValues,
    validators: {
      onChange: classCreateFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const classId = await createClass({
          ...value,
          schoolId,
        });

        router.push(`${pathname}/${classId}`);
        setOpenAction(false);
        form.reset();
      } catch (error) {
        captureException(error, {
          source: "school-class-create",
        });

        toast.error(t("create-class-failed"));
      }
    },
  });

  return (
    <form
      id="school-classes-header-add-form"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
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
                <Spinner isLoading={isSubmitting} />
                {t("create")}
              </Button>
            )}
          </form.Subscribe>
        }
        open={open}
        setOpen={setOpenAction}
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
                    onChange={(event) => field.handleChange(event.target.value)}
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
                  <div className="flex gap-2">
                    <Input
                      aria-invalid={isInvalid}
                      id="school-classes-header-add-subject"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder={t("subject-placeholder")}
                      value={field.state.value}
                    />

                    <Popover
                      onOpenChange={setSubjectPopoverOpen}
                      open={subjectPopoverOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          aria-label="Select subject"
                          size="icon"
                          variant="outline"
                        >
                          <HugeIcons
                            className={cn(
                              "transition-transform ease-out",
                              subjectPopoverOpen && "rotate-180"
                            )}
                            icon={ArrowDown01Icon}
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
                                  <HugeIcons
                                    className={cn(
                                      "ml-auto size-4 opacity-0 transition-opacity ease-out",
                                      field.state.value === t(subject) &&
                                        "opacity-100"
                                    )}
                                    icon={Tick01Icon}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
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
                        <HugeIcons icon={Calendar03Icon} />
                        {field.state.value || t("year-placeholder")}
                        <HugeIcons className="ml-auto" icon={ArrowDown01Icon} />
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
                          <HugeIcons
                            className={cn(
                              "ml-auto size-4 opacity-0 transition-opacity ease-out",
                              field.state.value === year && "opacity-100"
                            )}
                            icon={Tick01Icon}
                          />
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="visibility">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="school-classes-header-add-visibility">
                    {t("visibility-label")}
                  </FieldLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-invalid={isInvalid}
                        className="w-full font-normal"
                        id="school-classes-header-add-visibility"
                        name={field.name}
                        variant="outline"
                      >
                        <HugeIcons icon={ViewIcon} />
                        {t(field.state.value)}
                        <HugeIcons className="ml-auto" icon={ArrowDown01Icon} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-(--radix-dropdown-menu-trigger-width)"
                    >
                      {classVisibilityList.map((visibility) => (
                        <DropdownMenuItem
                          className="cursor-pointer"
                          key={visibility}
                          onSelect={() => field.handleChange(visibility)}
                        >
                          {t(visibility)}
                          <HugeIcons
                            className={cn(
                              "ml-auto size-4 opacity-0 transition-opacity ease-out",
                              field.state.value === visibility && "opacity-100"
                            )}
                            icon={Tick01Icon}
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
