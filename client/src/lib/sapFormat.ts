import type { ParsedCustomerOrder, SapLine } from "@shared/orderTypes";

export function formatSapLine(line: SapLine): string {
  return `${line.fgCode}\t\t${line.qtyPkts}\t\t\t\t\t${line.warehouse}\t\t${line.productGroup}`;
}

export function customerSapRows(customer: ParsedCustomerOrder): string {
  return customer.sapLines.map(formatSapLine).join("\n");
}

export function visibleSapLine(line: SapLine): string {
  return `${line.fgCode}  ·  ${line.qtyPkts} PKTS  ·  ${line.warehouse}  ·  ${line.productGroup}`;
}
