import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { inspectHeaderActions } from "#scripts/check/actions";
import { parseSources } from "#scripts/check/source";

const FRAME = {
  file: "apps/www/src/components/shared/page/header.tsx",
  sourceText: `
export function PageHeader({ children }) {
  return <header>{children}</header>;
}
export function PageActions({ children }) {
  return <div data-slot="page-actions">{children}</div>;
}`,
};
/**
 * A header that places its children in the row, one that places a member of its value there, one that takes its
 * actions as a prop, the outline toggle that shows an icon alone, and a control whose sizes differ.
 */
const HEADERS = {
  file: "apps/www/src/components/tenant/header.tsx",
  sourceText: `import { PageActions, PageHeader } from "@/components/shared/page/header";
export function SchoolHeader({ children }) {
  return (
    <PageHeader>
      {children === undefined ? null : <PageActions>{children}</PageActions>}
    </PageHeader>
  );
}
export function BreadcrumbHeader({ value }) {
  const { action } = value;
  return (
    <PageHeader>
      <PageActions>{action}</PageActions>
    </PageHeader>
  );
}
export function SettingsPage({ actions, children }) {
  return (
    <>
      <SchoolHeader>{actions}</SchoolHeader>
      {children}
    </>
  );
}
export function OutlineToggle({ label }) {
  return <SidebarTrigger label={label} size="icon" variant="outline" />;
}
export function ViewSwitch({ wide }) {
  return <Button size={wide ? "sm" : "icon-sm"} />;
}`,
};
const PAGE = "apps/www/src/components/tenant/page.tsx";
const pills = (line: number, count: number) =>
  `${PAGE}:${line}: a page header shows ${count} standalone pills. A header shows at most two: put the other actions in its one ButtonGroup.`;
const apart = (line: number, icons: number, groups: number) =>
  `${PAGE}:${line}: a page header shows ${icons} icon buttons and ${groups} button groups apart. Its secondary icon actions, such as More or the outline toggle, stand in one ButtonGroup.`;

/** Inspects a page module with the frame and the header components beside it. */
function inspect(sourceText: string) {
  return Effect.scoped(
    Effect.map(
      parseSources([FRAME, HEADERS, { file: PAGE, sourceText }]),
      ({ modules }) => inspectHeaderActions(modules)
    )
  );
}

describe("Page header source policy", () => {
  it.effect(
    "refuses a third standalone pill, through every header component",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import { PageActions } from "@/components/shared/page/header";
import { BreadcrumbHeader, SchoolHeader, SettingsPage, ViewSwitch } from "@/components/tenant/header";
export function Home() {
  return (
    <>
      <SchoolHeader>
        <NewPoll />
        <NewAnnouncement />
        <Button>{t("share")}</Button>
      </SchoolHeader>
      <BreadcrumbHeader value={{ action: <><Button /><Button /><Button /></>, items }} />
      <SettingsPage actions={<><Select /><ViewSwitch /><Picker /></>}>{body}</SettingsPage>
      <PageActions>
        <Button />
        {(open && <Link className={buttonVariants()} />)}
        <Button size={size} />
      </PageActions>
    </>
  );
}`),
          [pills(6, 3), pills(11, 3), pills(12, 3), pills(13, 3)]
        );
      })
  );

  it.effect(
    "refuses a secondary icon action standing apart from the group or from another",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import { PageActions } from "@/components/shared/page/header";
import { OutlineToggle, SchoolHeader } from "@/components/tenant/header";
export function Lesson() {
  return (
    <>
      <SchoolHeader>
        <ButtonGroup />
        <OutlineToggle label={t("outline")} />
      </SchoolHeader>
      <PageActions>
        <Button size="icon" tooltip={t("more")} />
        <DropdownMenuTrigger render={<Button size="icon-sm" tooltip={t("menu")} />} />
      </PageActions>
      <PageActions>
        <Link className={buttonVariants({ size: "icon", variant: "outline" })} />
        <ButtonGroup />
      </PageActions>
      <PageActions>
        <ButtonGroup />
        <ButtonGroup />
      </PageActions>
    </>
  );
}`),
          [apart(6, 1, 1), apart(10, 2, 0), apart(14, 1, 1), apart(18, 0, 2)]
        );
      })
  );

  it.effect(
    "accepts two pills and one group, a lone icon action, a search, a dialog, and a choice between two buttons",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import { PageActions } from "@/components/shared/page/header";
import { BreadcrumbHeader, OutlineToggle, SchoolHeader, SettingsPage } from "@/components/tenant/header";
export function Home() {
  return (
    <>
      <SchoolHeader>
        <TableSearch />
        <Button>{t("share")}</Button>
        <SchoolHeaderAdd />
        <ButtonGroup>
          <Button size="icon" />
          <OutlineToggle />
        </ButtonGroup>
        <ClassDialog />
      </SchoolHeader>
      <SchoolHeader>
        <OutlineToggle label={t("outline")} />
        <Button>{t("add")}</Button>
      </SchoolHeader>
      <SchoolHeader>{editing ? <Button>{t("save")}</Button> : <Button>{t("edit")}</Button>}</SchoolHeader>
      <SchoolHeader />
      <BreadcrumbHeader value={header} />
      <BreadcrumbHeader value={{ items }} />
      <SettingsPage actions={<TableSearch />}>{body}</SettingsPage>
      <PageActions>{}</PageActions>
      <PageActions><this.Part /></PageActions>
      <PageActions />
    </>
  );
}`),
          []
        );
      })
  );

  it.effect(
    "counts a component whose root is a ButtonGroup as one group, and a header's search slot as no action",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import { PageActions } from "@/components/shared/page/header";
import { OutlineToggle, SchoolHeader } from "@/components/tenant/header";
function ProctorActions({ open }) {
  const handlers = { press() { return <Button />; } };
  function label() { return <span />; }
  const pick = function () { return <Button />; };
  const leave = () => <Button />;
  if (open === undefined) {
    return;
  }
  if (!open) {
    return null;
  }
  return (
    <ButtonGroup>
      <Button />
    </ButtonGroup>
  );
}
const ShareTools = () => <ButtonGroup />;
const MoreTools = function () {
  return <ButtonGroup />;
};
function Mixed({ grouped }) {
  return grouped ? <ButtonGroup /> : <Button />;
}
function Nothing() {
  return null;
}
export function SurahHeader({ actions, search }) {
  return (
    <PageActions>
      {search}
      <ButtonGroup>{actions}</ButtonGroup>
      <OutlineToggle label="outline" />
    </PageActions>
  );
}
export function Sitting() {
  return (
    <>
      <SchoolHeader>
        <ProctorActions open />
        <EndButton />
      </SchoolHeader>
      <SchoolHeader>
        <ShareTools />
        <MoreTools />
      </SchoolHeader>
      <SchoolHeader>
        <Mixed />
        <Nothing />
      </SchoolHeader>
      <SurahHeader actions={<Button />} search={<SurahFind />} />
    </>
  );
}`),
          [apart(32, 1, 1), apart(46, 0, 2)]
        );
      })
  );

  it.effect(
    "reports a crowded header where it draws its own row, and not again at each usage",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import { PageActions } from "@/components/shared/page/header";
export function ExamHeader({ children }) {
  return (
    <PageActions>
      <Timer />
      <Submit />
      <Leave />
      {children}
    </PageActions>
  );
}
export function Exam() {
  return <ExamHeader><Button /></ExamHeader>;
}`),
          [pills(4, 3)]
        );
      })
  );

  it.effect("stops reading a header that draws itself in its own row", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`import { PageActions } from "@/components/shared/page/header";
export function Tree({ children }) {
  return (
    <PageActions>
      {children}
      <Tree>
        <Button />
      </Tree>
    </PageActions>
  );
}`),
        [pills(4, 13)]
      );
    })
  );

  it.effect(
    "leaves a component named PageActions that is not the frame's",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
function PageActions({ children }) {
  return <div>{children}</div>;
}
export function Paper() {
  return <PageActions><Button /><Button /><Button /></PageActions>;
}`),
          []
        );
      })
  );
});
