export type SapLine = {
  fgCode: string;
  qtyPkts: number;
  warehouse: string;
  productGroup: string;
};

export type ParsedCustomerOrder = {
  customerName: string;
  sapLines: SapLine[];
  warnings: string[];
};

export type ParsedOrderResult = {
  customers: ParsedCustomerOrder[];
  generalWarnings: string[];
};
