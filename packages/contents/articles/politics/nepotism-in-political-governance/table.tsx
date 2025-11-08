import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";

type Props = {
  caption: string;
  labels: {
    country: string;
    judicialEfficiencyIndex: string;
    corruptionIndex: string;
    goodGovernanceIndex: string;
    governanceQualityCategory: string;
    good: string;
    medium: string;
    low: string;
  };
};

export function StateTable({ caption, labels }: Props) {
  return (
    <div className="grid grid-cols-1">
      <Table containerClassName="scrollbar-hide">
        <TableCaption>{caption}</TableCaption>
        <TableHeader className="border-x border-t bg-accent text-accent-foreground">
          <TableRow>
            <TableHead className="border-r text-center">
              {labels.country}
            </TableHead>
            <TableHead className="border-r text-center">
              {labels.judicialEfficiencyIndex}
            </TableHead>
            <TableHead className="border-r text-center">
              {labels.corruptionIndex}
            </TableHead>
            <TableHead className="border-r text-center">
              {labels.goodGovernanceIndex}
            </TableHead>
            <TableHead className="text-center">
              {labels.governanceQualityCategory}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="border-x border-b">
          <TableRow>
            <TableCell className="border-r bg-accent text-center font-medium text-accent-foreground">
              Malaysia
            </TableCell>
            <TableCell className="border-r text-center">9,00</TableCell>
            <TableCell className="border-r text-center">7,38</TableCell>
            <TableCell className="border-r text-center">7,22</TableCell>
            <TableCell className="text-center">{labels.good}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="border-r bg-accent text-center font-medium text-accent-foreground">
              Singapore
            </TableCell>
            <TableCell className="border-r text-center">10,00</TableCell>
            <TableCell className="border-r text-center">8,22</TableCell>
            <TableCell className="border-r text-center">8,93</TableCell>
            <TableCell className="text-center">{labels.good}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="border-r bg-accent text-center font-medium text-accent-foreground">
              Thailand
            </TableCell>
            <TableCell className="border-r text-center">3,25</TableCell>
            <TableCell className="border-r text-center">5,18</TableCell>
            <TableCell className="border-r text-center">4,89</TableCell>
            <TableCell className="text-center">{labels.medium}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="border-r bg-accent text-center font-medium text-accent-foreground">
              Philippines
            </TableCell>
            <TableCell className="border-r text-center">4,75</TableCell>
            <TableCell className="border-r text-center">7,92</TableCell>
            <TableCell className="border-r text-center">3,47</TableCell>
            <TableCell className="text-center">{labels.medium}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="border-r bg-accent text-center font-medium text-accent-foreground">
              Indonesia
            </TableCell>
            <TableCell className="border-r text-center">2,50</TableCell>
            <TableCell className="border-r text-center">2,15</TableCell>
            <TableCell className="border-r text-center">2,88</TableCell>
            <TableCell className="text-center">{labels.low}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
