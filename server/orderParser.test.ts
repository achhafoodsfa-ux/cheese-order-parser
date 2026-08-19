import { describe, expect, it } from "vitest";
import { calculateLocal7030PktQuantity, enforceAchhaMozBlockPhysicalQuantity, enforceLocal7030ShreddedQuantity, enforcePizzaCheddarBlockPhysicalQuantity, extractLocal7030ShreddedTargets, formatCustomerSapBlock, formatSapLine, identifyPizzaCheddarBlock, needsFullMasterLookup, normalizeParsedOrder, parseValidatedModelResult, recognizeAchhaMozBlockPhysicalQty, recognizeLocal7030CartonPkts, recognizePizzaCheddarBlockPhysicalQty } from "./orderParser";

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

describe("structured model-response recovery", () => {
  it("does not throw when a model response contains unterminated JSON", () => {
    expect(parseValidatedModelResult('{"customers":[{"customerName":"Furqan')).toBeNull();
  });

  it("accepts JSON wrapped in a markdown fence after validation", () => {
    const content = '```json\n{"customers":[{"customerName":"Furqan AFPL","sapLines":[{"fgCode":"FG-03-0006","qtyPkts":15,"warehouse":"HO-WH","productGroup":"CHEESE"}],"warnings":[]}],"generalWarnings":[]}\n```';
    expect(parseValidatedModelResult(content)?.customers[0]?.customerName).toBe("Furqan AFPL");
  });

  it("requests the full product master only when the compact mapping flags a missing item", () => {
    expect(needsFullMasterLookup({ customers: [], generalWarnings: ["MASTER_LOOKUP_REQUIRED"] })).toBe(true);
    expect(needsFullMasterLookup({ customers: [], generalWarnings: ["No ambiguity"] })).toBe(false);
  });
});

describe("Local 70/30 product-first carton recognition", () => {
  it("identifies style before selecting the Local 70/30 carton conversion", () => {
    expect(recognizeLocal7030CartonPkts("01 ctn Local 70/30 2KG shredded")).toBe(5);
    expect(recognizeLocal7030CartonPkts("01 ctn Local 70/30 block")).toBe(10);
    expect(recognizeLocal7030CartonPkts("01 ctn Local 70/30 slices")).toBe(18);
    expect(recognizeLocal7030CartonPkts("01 ctn imported 70/30")).toBeUndefined();
    expect(calculateLocal7030PktQuantity("01 ctn Local 70/30 2KG")).toBe(5);
    expect(calculateLocal7030PktQuantity("02 ctn Local 70/30 block")).toBe(20);
    expect(calculateLocal7030PktQuantity("03 ctn Local 70/30 slices")).toBe(54);
  });

  it("overrides an incorrect AI shredded quantity with exactly five packets per carton", () => {
    const corrected = enforceLocal7030ShreddedQuantity({ customers: [{ customerName: "Customer", sapLines: [{ fgCode: "FG-03-0018", qtyPkts: 1, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] }], generalWarnings: [] }, "01 ctn Local 70/30 2KG shredded");
    expect(corrected.customers[0]?.sapLines[0]?.qtyPkts).toBe(5);
  });

  it("applies Local 70/30 shredded carton conversions independently for multiple customers", () => {
    const source = "Alpha Foods\n01 ctn Local 70/30 2KG shredded\n\nBeta Foods\n02 ctn Local 70/30 2KG shredded";
    expect(extractLocal7030ShreddedTargets(source)).toEqual([{ customerName: "Alpha Foods", qtyPkts: 5 }, { customerName: "Beta Foods", qtyPkts: 10 }]);
    const corrected = enforceLocal7030ShreddedQuantity({ customers: [
      { customerName: "Alpha Foods", sapLines: [{ fgCode: "FG-03-0018", qtyPkts: 1, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] },
      { customerName: "Beta Foods", sapLines: [{ fgCode: "FG-03-0018", qtyPkts: 2, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] },
    ], generalWarnings: [] }, source);
    expect(corrected.customers[0]?.sapLines[0]?.qtyPkts).toBe(5);
    expect(corrected.customers[1]?.sapLines[0]?.qtyPkts).toBe(10);
  });
});

describe("WhatsApp customer bubble preservation", () => {
  it("keeps a readable customer with a warning instead of silently dropping a missed final order", () => {
    const normalized = normalizeParsedOrder({ customers: [], generalWarnings: [], detectedBubbles: [{ customerName: "Nadeem Sb", rawOrderText: "EO Food 25 ctn UK Shredd" }] });
    expect(normalized.customers).toEqual([{ customerName: "Nadeem Sb", sapLines: [], warnings: ["Order captured from the screenshot, but product matching needs verification before SAP rows can be created."] }]);
  });
});

describe("Achha Mozz block physical quantities", () => {
  it("keeps a block quantity as physical packets rather than converting it as a carton", () => {
    expect(recognizeAchhaMozBlockPhysicalQty("Acha Moz blk 5 blk")).toBe(5);
    expect(recognizeAchhaMozBlockPhysicalQty("Achha Moz block 5")).toBe(5);
    expect(recognizeAchhaMozBlockPhysicalQty("Achha Moz block 2 ctn")).toBeUndefined();
    const corrected = enforceAchhaMozBlockPhysicalQuantity({ customers: [{ customerName: "Trade hub Pia Road", sapLines: [{ fgCode: "FG-01-0006", qtyPkts: 10, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] }], generalWarnings: [], detectedBubbles: [{ customerName: "Trade hub Pia Road", rawOrderText: "Acha Moz blk 5 blk" }] }, "");
    expect(corrected.customers[0]?.sapLines[0]?.qtyPkts).toBe(5);
  });
});

describe("Pizza Cheddar Block recognition", () => {
  it("normalizes Pizza Chadder wording and preserves the stated physical block quantity", () => {
    expect(recognizePizzaCheddarBlockPhysicalQty("Pizza Chadder blk 5 pcs")).toBe(5);
    expect(recognizePizzaCheddarBlockPhysicalQty("Pizza Cheddar block 2 ctn")).toBeUndefined();
    expect(identifyPizzaCheddarBlock("Pizza Chadder blk 5 pcs")).toEqual({ fgCode: "FG-02-0006", qtyPkts: 5 });
    const corrected = enforcePizzaCheddarBlockPhysicalQuantity({ customers: [{ customerName: "Baba Latif Johar town", sapLines: [{ fgCode: "FG-01-0042", qtyPkts: 20, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] }], generalWarnings: [], detectedBubbles: [{ customerName: "Baba Latif Johar town", rawOrderText: "Pizza Chadder blk 5 pcs" }] }, "");
    expect(corrected.customers[0]?.sapLines).toContainEqual({ fgCode: "FG-02-0006", qtyPkts: 5, warehouse: "HO-WH", productGroup: "CHEESE" });
  });
});
