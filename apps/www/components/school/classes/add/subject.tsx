"use client";

import {
  ArrowDown01Icon,
  Search02Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@repo/design-system/components/ui/autocomplete";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { subjectList } from "@/components/school/classes/data/subject";

interface HeaderAddSubjectFieldProps {
  isInvalid: boolean;
  name: string;
  onBlur: () => void;
  onValueChange: (value: string) => void;
  value: string;
}

/** Renders the subject input and picker for the school class create dialog. */
export function HeaderAddSubjectField({
  isInvalid,
  name,
  onBlur,
  onValueChange,
  value,
}: HeaderAddSubjectFieldProps) {
  const t = useTranslations("School.Classes");
  const [subjectPopoverOpen, subjectPopoverHandlers] = useDisclosure(false);
  const subjectOptions = subjectList.map((subject) => ({
    label: t(subject),
    value: subject,
  }));
  const subjectGroups = [
    {
      items: subjectOptions,
      value: t("subject-label"),
    },
  ];

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor="school-classes-header-add-subject">
        {t("subject-label")}
      </FieldLabel>
      <ButtonGroup>
        <Input
          aria-invalid={isInvalid}
          id="school-classes-header-add-subject"
          name={name}
          onBlur={onBlur}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={t("subject-placeholder")}
          value={value}
        />

        <Popover
          onOpenChange={subjectPopoverHandlers.set}
          open={subjectPopoverOpen}
        >
          <PopoverTrigger
            render={
              <Button
                aria-label="Select subject"
                size="icon"
                type="button"
                variant="outline"
              />
            }
          >
            <HugeIcons
              className={cn(
                "transition-transform ease-out",
                subjectPopoverOpen && "rotate-180"
              )}
              icon={ArrowDown01Icon}
            />
          </PopoverTrigger>
          <PopoverContent align="end" className="p-0">
            <Autocomplete
              autoHighlight="always"
              inline
              items={subjectGroups}
              keepHighlight
              open
            >
              <AutocompleteInput
                className="h-9 rounded-none border-x-0 border-t-0 border-b shadow-none focus-visible:ring-inset"
                placeholder={t("search-subjects-placeholder")}
                showClear
                startAddon={
                  <HugeIcons className="size-4" icon={Search02Icon} />
                }
              />
              <AutocompleteEmpty>{t("no-subjects-found")}</AutocompleteEmpty>
              <AutocompleteList className="max-h-75" scrollArea={false}>
                {(group) => (
                  <AutocompleteGroup items={group.items} key={group.value}>
                    <AutocompleteCollection>
                      {(subject) => (
                        <AutocompleteItem
                          className="min-h-8 cursor-pointer py-1.5 text-sm sm:min-h-8"
                          key={subject.value}
                          onClick={() => {
                            onValueChange(subject.label);
                            subjectPopoverHandlers.close();
                          }}
                          value={subject}
                        >
                          <span>{subject.label}</span>
                          <HugeIcons
                            className={cn(
                              "ml-auto size-4 opacity-0 transition-opacity ease-out",
                              value === subject.label && "opacity-100"
                            )}
                            icon={Tick01Icon}
                          />
                        </AutocompleteItem>
                      )}
                    </AutocompleteCollection>
                  </AutocompleteGroup>
                )}
              </AutocompleteList>
            </Autocomplete>
          </PopoverContent>
        </Popover>
      </ButtonGroup>
    </Field>
  );
}
