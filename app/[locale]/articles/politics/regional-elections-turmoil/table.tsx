import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      <Table containerClassName="scrollbar-hide">
        <TableCaption>{caption}</TableCaption>
        <TableHeader className="border-x border-t bg-muted/50">
          <TableRow>
            <TableHead className="w-1/4">{headers.category}</TableHead>
            <TableHead className="w-1/4">{headers.electionLaw}</TableHead>
            <TableHead className="w-1/4">{headers.courtDecision}</TableHead>
            <TableHead className="w-1/4">{headers.dprDecision}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="border-x border-b">
          {tableData.map((row, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{row.category}</TableCell>
              <TableCell>{row.electionLaw}</TableCell>
              <TableCell>{row.courtDecision}</TableCell>
              <TableCell>{row.dprDecision}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
