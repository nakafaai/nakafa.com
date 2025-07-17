import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";

export type TableRowData = {
  category: string;
  electionLaw: string;
  courtDecision: string;
  dprDecision: string;
};

type Props = {
  caption: string;
  tableData: TableRowData[];
  headers?: {
    category: string;
    electionLaw: string;
    courtDecision: string;
    dprDecision: string;
  };
};

export function RulingTable({
  caption,
  tableData,
  headers = {
    category: "Regulation Category",
    electionLaw: "Election Law",
    courtDecision: "Constitutional Court Decision",
    dprDecision: "DPR Decision",
  },
}: Props) {
  return (
    <div className="grid grid-cols-1">
      <Table containerClassName="pb-4">
        <TableCaption>{caption}</TableCaption>
        <TableHeader className="border-x border-t bg-accent text-accent-foreground">
          <TableRow>
            <TableHead className="w-1/4 border-r text-center">
              {headers.category}
            </TableHead>
            <TableHead className="w-1/4 border-r text-center">
              {headers.electionLaw}
            </TableHead>
            <TableHead className="w-1/4 border-r text-center">
              {headers.courtDecision}
            </TableHead>
            <TableHead className="w-1/4 text-center">
              {headers.dprDecision}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="border-x border-b">
          {tableData.map((row) => (
            <TableRow key={row.category}>
              <TableCell className="border-r bg-accent text-center font-medium text-accent-foreground">
                {row.category}
              </TableCell>
              <TableCell className="border-r text-center">
                {row.electionLaw}
              </TableCell>
              <TableCell className="border-r text-center">
                {row.courtDecision}
              </TableCell>
              <TableCell className="text-center">{row.dprDecision}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
