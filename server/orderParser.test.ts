import { describe, expect, it } from "vitest";
import { formatCustomerSapBlock, formatSapLine, normalizeParsedOrder } from "./orderParser";

describe("SAP order formatting", () => {
  it("renders the exact SAP row with two, five, then two tabs", () => {
    const line = formatSapLine({ fgCode: "FG-01-0042", qtyPkts: 20, warehouse: "HO-WH", productGroup: "CHEESE" });
    expect(line).toBe("FG-01-0042\t\t20\t\t\t\t\tHO-WH\t\tCHEESE");
  });

  it("copies SAP rows only and does not embed the customer heading", () => {
    const block = formatCustomerSapBlock({ customerName: "Babar Ali", warnings: [], sapLines: [{ fgCode: "FG-01-0042", qtyPkts: 20, warehouse: "HO-WH", productGroup: "CHEESE" }] });
    expect(block).not.toContain("Babar Ali");
    expect(block).toContain("FG-01-0042\t\t20");
  });
});

describe("customer separation", () => {
  it("merges repeated codes only within the same customer", () => {
    const result = normalizeParsedOrder({
      customers: [
        { customerName: "Customer One", warnings: [], sapLines: [{ fgCode: "FG-01-0042", qtyPkts: 10, warehouse: "HO-WH", productGroup: "CHEESE" }, { fgCode: "FG-01-0042", qtyPkts: 5, warehouse: "HO-WH", productGroup: "CHEESE" }] },
        { customerName: "Customer Two", warnings: [], sapLines: [{ fgCode: "FG-01-0042", qtyPkts: 8, warehouse: "HO-WH", productGroup: "CHEESE" }] },
      ],
      generalWarnings: [],
    });

    expect(result.customers).toHaveLength(2);
    expect(result.customers[0].sapLines).toEqual([{ fgCode: "FG-01-0042", qtyPkts: 15, warehouse: "HO-WH", productGroup: "CHEESE" }]);
    expect(result.customers[1].sapLines).toEqual([{ fgCode: "FG-01-0042", qtyPkts: 8, warehouse: "HO-WH", productGroup: "CHEESE" }]);
  });
});
