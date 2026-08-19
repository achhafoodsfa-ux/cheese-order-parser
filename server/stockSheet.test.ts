import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { populateStockSheet } from "./stockSheet";

function testTemplate(): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(Array.from({ length: 12 }, () => Array.from({ length: 9 }, () => "")));
  sheet.G7 = { t: "s", v: "FG-02-0006" };
  sheet.H7 = { t: "s", v: "FG-03-0018" };
  sheet["!ref"] = "A1:I12";
  return XLSX.write({ SheetNames: ["OrderSheet"], Sheets: { OrderSheet: sheet } }, { type: "buffer", bookType: "xlsx" });
}

describe("populateStockSheet", () => {
  it("writes independent branch totals into the matching supplied-format SAP columns", () => {
    const result = populateStockSheet(testTemplate(), [
      { branchName: "GR", parsed: { customers: [{ customerName: "GR", sapLines: [{ fgCode: "FG-02-0006", qtyPkts: 5, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] }], generalWarnings: [], detectedBubbles: [] } },
      { branchName: "Imtiaz Butt", parsed: { customers: [{ customerName: "Imtiaz", sapLines: [{ fgCode: "FG-03-0018", qtyPkts: 10, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] }], generalWarnings: [], detectedBubbles: [] } },
      { branchName: "Shah Noor", parsed: { customers: [{ customerName: "Shah", sapLines: [{ fgCode: "FG-02-0006", qtyPkts: 2, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] }], generalWarnings: [], detectedBubbles: [] } },
    ]);
    const workbook = XLSX.read(result.data, { type: "buffer" });
    const sheet = workbook.Sheets.OrderSheet;
    expect(sheet.G9?.v).toBe(5);
    expect(sheet.H10?.v).toBe(10);
    expect(sheet.G11?.v).toBe(2);
    expect(sheet.C10?.v).toBe("Imtiaz Butt");
  });

  it("preserves and fills the supplied StockSheetFinalFormate workbook", () => {
    const template = readFileSync("/home/ubuntu/upload/StockSheetFinalFormate.xlsx");
    const result = populateStockSheet(template, [
      { branchName: "GR", parsed: { customers: [{ customerName: "GR", sapLines: [{ fgCode: "FG-02-0006", qtyPkts: 5, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] }], generalWarnings: [], detectedBubbles: [] } },
      { branchName: "Imtiaz Butt", parsed: { customers: [{ customerName: "Imtiaz", sapLines: [{ fgCode: "FG-03-0018", qtyPkts: 10, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] }], generalWarnings: [], detectedBubbles: [] } },
      { branchName: "Shah Noor", parsed: { customers: [{ customerName: "Shah", sapLines: [{ fgCode: "FG-02-0006", qtyPkts: 2, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] }], generalWarnings: [], detectedBubbles: [] } },
    ]);
    const workbook = XLSX.read(result.data, { type: "buffer" });
    const sheet = workbook.Sheets.OrderSheet;
    expect(sheet.G9?.v).toBe(5);
    expect(sheet.G11?.v).toBe(2);
    expect(sheet.C10?.v).toBe("Imtiaz Butt");
  });
});
