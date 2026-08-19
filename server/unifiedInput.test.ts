import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { attachmentKind, spreadsheetToOrderText } from "./routers";

describe("unified order input", () => {
  it("recognizes image, PDF, and spreadsheet attachments", () => {
    expect(attachmentKind("image/png")).toBe("image");
    expect(attachmentKind("application/pdf")).toBe("pdf");
    expect(attachmentKind("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("xlsx");
  });

  it("extracts worksheet rows into a bounded AI-readable order source", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([["Customer", "Product", "Units"], ["Babar Ali", "Achha Shred", 20]]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Orders");
    const encoded = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const text = spreadsheetToOrderText(`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${encoded}`, "orders.xlsx");

    expect(text).toContain("ATTACHED EXCEL ORDER FILE: orders.xlsx");
    expect(text).toContain("SHEET: Orders");
    expect(text).toContain("Babar Ali,Achha Shred,20");
  });
});
