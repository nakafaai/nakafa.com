import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations } from "next-intl";

type Props = {
  caption: string;
};

export function StateTable({ caption }: Props) {
  const t = useTranslations("Common");
  return (
    <div className="grid grid-cols-1">
      <Table containerClassName="scrollbar-hide">
        <TableCaption>{caption}</TableCaption>
        <TableHeader className="border-x border-t bg-muted/50">
          <TableRow>
            <TableHead>{t("country")}</TableHead>
            <TableHead>{t("judicial-efficiency-index")}</TableHead>
            <TableHead>{t("corruption-index")}</TableHead>
            <TableHead>{t("good-governance-index")}</TableHead>
            <TableHead>{t("governance-quality-category")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="border-x border-b">
          <TableRow>
            <TableCell className="font-medium">Malaysia</TableCell>
            <TableCell>9,00</TableCell>
            <TableCell>7,38</TableCell>
            <TableCell>7,22</TableCell>
            <TableCell>{t("good")}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Singapore</TableCell>
            <TableCell>10,00</TableCell>
            <TableCell>8,22</TableCell>
            <TableCell>8,93</TableCell>
            <TableCell>{t("good")}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Thailand</TableCell>
            <TableCell>3,25</TableCell>
            <TableCell>5,18</TableCell>
            <TableCell>4,89</TableCell>
            <TableCell>{t("medium")}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Philippines</TableCell>
            <TableCell>4,75</TableCell>
            <TableCell>7,92</TableCell>
            <TableCell>3,47</TableCell>
            <TableCell>{t("medium")}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Indonesia</TableCell>
            <TableCell>2,50</TableCell>
            <TableCell>2,15</TableCell>
            <TableCell>2,88</TableCell>
            <TableCell>{t("low")}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
