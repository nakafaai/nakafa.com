import { PlayCases } from "@repo/design-system/components/contents/mathematics/logic/play";
import type { SwitchName } from "@repo/design-system/components/contents/mathematics/logic/scene";
import { LogicScene } from "@repo/design-system/components/contents/mathematics/logic/scene";
import {
  setCase,
  setMode,
  startBoard,
  tableRows,
} from "@repo/design-system/components/contents/mathematics/logic/table";
import type { LogicMode } from "@repo/design-system/components/contents/mathematics/logic/truth";
import {
  truthOf,
  usesQ,
} from "@repo/design-system/components/contents/mathematics/logic/truth";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardTable,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

/**
 * Two statements as two switches on a circuit board: p is "switch P is
 * closed" and q is "switch Q is closed", and the lamp lit is the truth of the
 * compound the board is wired for. For "p and q" the switches stand in
 * series, for "p or q" side by side, and for "not p" P lies across the lamp,
 * so closing it puts the lamp out. The learner throws the switches on the
 * board or in the toolbar, or presses Play to step through every case, and
 * the truth table under the board marks the current row and fills each row
 * as its case is tried. Without `showTable`, as in a question that asks when
 * the compound is true, the table has no column for the compound and the
 * footer does not give its value.
 */
export function SwitchLogicLab({
  description,
  labels,
  modes,
  showTable = false,
  startMode,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly compounds: Readonly<Record<LogicMode, ReactNode>>;
    readonly false: string;
    readonly mode: string;
    readonly modes: Readonly<Record<LogicMode, string>>;
    readonly p: ReactNode;
    readonly q: ReactNode;
    readonly switches: string;
    readonly true: string;
    readonly viewLabel: string;
  };
  readonly modes: readonly [LogicMode, ...LogicMode[]];
  readonly showTable?: boolean;
  readonly startMode?: LogicMode;
  readonly title: NonNullable<ReactNode>;
}) {
  const [board, setBoard] = useState(() =>
    startBoard(
      startMode !== undefined && Arr.contains(modes, startMode)
        ? startMode
        : modes[0]
    )
  );
  const { mode, state } = board;
  const withQ = usesQ(mode);
  const closed = Arr.filter(["p", "q"] as const, (name) => state[name]);
  const word = (value: boolean) => (value ? labels.true : labels.false);
  const toggle = (name: SwitchName) =>
    setBoard((shown) =>
      setCase(shown, { ...shown.state, [name]: !shown.state[name] })
    );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        {modes.length > 1 ? (
          <ToggleGroup
            aria-label={labels.mode}
            gridColumns={modes.length > 2 ? "3" : "2"}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(modes, (each) => each === next),
                (chosen) => setBoard((shown) => setMode(shown, chosen))
              );
            }}
            type="single"
            value={mode}
            variant="outline"
          >
            {Arr.map(modes, (each) => (
              <ToggleGroupItem key={each} value={each}>
                {labels.modes[each]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
        <ToggleGroup
          aria-label={labels.switches}
          onValueChange={(next: readonly string[]) =>
            setBoard((shown) =>
              setCase(shown, {
                p: Arr.contains(next, "p"),
                q: Arr.contains(next, "q"),
              })
            )
          }
          type="multiple"
          value={closed}
          variant="outline"
        >
          <ToggleGroupItem value="p">P</ToggleGroupItem>
          {withQ ? <ToggleGroupItem value="q">Q</ToggleGroupItem> : null}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.3} setting="lab">
          <PlayCases
            mode={mode}
            onCase={(next) => setBoard((shown) => setCase(shown, next))}
          />
          <Suspense fallback={null}>
            <LogicScene mode={mode} onToggle={toggle} state={state} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardTable>
        <Table>
          <TableCaption className="sr-only">
            {labels.compounds[mode]}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">
                <InlineMath math="p" />
              </TableHead>
              {withQ ? (
                <TableHead scope="col">
                  <InlineMath math="q" />
                </TableHead>
              ) : null}
              {showTable ? (
                <TableHead scope="col">{labels.compounds[mode]}</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Arr.map(tableRows(board), (row) => (
              <TableRow
                aria-current={row.current ? "true" : undefined}
                data-state={row.current ? "selected" : undefined}
                key={row.row}
              >
                <TableCell>{word(row.case.p)}</TableCell>
                {withQ ? <TableCell>{word(row.case.q)}</TableCell> : null}
                {showTable ? (
                  <TableCell>
                    {Option.match(row.truth, {
                      onNone: () => (
                        <span className="text-muted-foreground">?</span>
                      ),
                      onSome: word,
                    })}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </VisualCardTable>

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular label={labels.p} value={word(state.p)} />
          {withQ ? (
            <VisualFactTabular label={labels.q} value={word(state.q)} />
          ) : null}
          {showTable ? (
            <VisualFactTabular
              label={labels.compounds[mode]}
              value={word(truthOf(mode, state))}
            />
          ) : null}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
