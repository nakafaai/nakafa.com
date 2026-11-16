import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr } from "effect";

const rows = [
  {
    section: "Quantitative reasoning",
    questions: 20,
    score: 712,
    status: "Passed",
  },
  {
    section: "Reading comprehension",
    questions: 20,
    score: 655,
    status: "Passed",
  },
  {
    section: "Mathematical reasoning",
    questions: 20,
    score: 498,
    status: "Review",
  },
];

export const card = {
  name: "Table",
  group: "Content",
  height: 280,
  source: "table",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="p-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Section</TableHead>
            <TableHead className="text-right">Questions</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Arr.map(rows, (row) => (
            <TableRow key={row.section}>
              <TableCell>{row.section}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.questions}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.score}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    row.status === "Passed"
                      ? "default-subtle"
                      : "destructive-subtle"
                  }
                >
                  {row.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
