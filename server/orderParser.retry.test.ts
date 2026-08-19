import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeLLM } = vi.hoisted(() => ({ invokeLLM: vi.fn() }));

vi.mock("./_core/llm", () => ({ invokeLLM }));

import { formatCustomerSapBlock, parseOrderWithAi } from "./orderParser";

const validJson = JSON.stringify({
  customers: [{ customerName: "Furqan AFPL", sapLines: [{ fgCode: "FG-03-0006", qtyPkts: 15, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] }],
  generalWarnings: [],
});

describe("AI structured-output retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "# OFFICIAL 229-ROW ITEM MASTER\nFG-03-0006" }));
  });

  it("retries with the fallback model when the first response has malformed JSON", async () => {
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: '{"customers":[{"customerName":"Furqan' } }] });
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: validJson } }] });

    const result = await parseOrderWithAi({ sourceText: "Furqan AFPL 3 ctn imp 70/30", masterUrl: "https://example.test/master" });

    expect(result.customers[0]?.customerName).toBe("Furqan AFPL");
    expect(invokeLLM).toHaveBeenCalledTimes(2);
    expect(invokeLLM.mock.calls[0]?.[0]).toMatchObject({ model: "gpt-5-mini" });
    expect(invokeLLM.mock.calls[1]?.[0]).toMatchObject({ model: "gemini-3-flash-preview" });
  });

  it("returns a safe operational error after both structured responses are invalid", async () => {
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: '{"customers":[' } }] });

    await expect(parseOrderWithAi({ sourceText: "Furqan AFPL 3 ctn imp 70/30", masterUrl: "https://example.test/master" }))
      .rejects.toThrow("This order could not be safely read");
  });

  it("includes user-approved durable rules in future parser instructions", async () => {
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: validJson } }] });

    await parseOrderWithAi({ sourceText: "Furqan AFPL 3 ctn imp 70/30", masterUrl: "https://example.test/master", learnedRules: ["Furqan AFPL uses approved imported 70/30 wording."] });

    expect(invokeLLM.mock.calls[0]?.[0]?.messages[0]?.content).toContain("Furqan AFPL uses approved imported 70/30 wording.");
  });

  it("handles the reported Local 70/30 carton order without an unknown-ratio warning", async () => {
    const localOrder = JSON.stringify({
      customers: [{ customerName: "Local Customer", sapLines: [{ fgCode: "FG-03-0018", qtyPkts: 1, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] }],
      generalWarnings: [],
    });
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: localOrder } }] });

    const result = await parseOrderWithAi({ sourceText: "01 ctn Local 70/30 2KG", masterUrl: "https://example.test/master" });

    expect(result.customers[0]?.sapLines[0]?.qtyPkts).toBe(5);
    expect(result.generalWarnings.join(" ")).not.toContain("carton-to-PKT conversion unknown");
    expect(invokeLLM.mock.calls[0]?.[0]?.messages[1]?.content[0]?.text).toContain("converts to 5 PKTS");
  });

  it("uses high-detail image reading and preserves the final WhatsApp customer bubble", async () => {
    const screenshotResult = JSON.stringify({
      customers: [
        { customerName: "Food trader township", sapLines: [{ fgCode: "FG-01-0042", qtyPkts: 40, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] },
        { customerName: "Trade hub Pia Road", sapLines: [{ fgCode: "FG-01-0006", qtyPkts: 10, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] },
        { customerName: "Baba Latif Johar town", sapLines: [{ fgCode: "FG-01-0042", qtyPkts: 20, warehouse: "HO-WH", productGroup: "CHEESE" }, { fgCode: "FG-02-0006", qtyPkts: 10, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] },
      ],
      generalWarnings: [],
      detectedBubbles: [
        { customerName: "Food trader township", rawOrderText: "Acha Moz shredded 8 ctn" },
        { customerName: "Trade hub Pia Road", rawOrderText: "Acha Moz blk 5 blk\nYellow slice 2 pkt" },
        { customerName: "Baba Latif Johar town", rawOrderText: "Pizza Cheddar blk 5 pcs\nAcha Moz shredded 20 pcs" },
        { customerName: "Nadeem Sb", rawOrderText: "EO Food\n25 ctn UK Shredd" },
      ],
    });
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: screenshotResult } }] });

    const result = await parseOrderWithAi({ sourceText: "", attachment: { kind: "image", filename: "whatsapp.png", mimeType: "image/png", dataUrl: "data:image/png;base64,AA==" }, masterUrl: "https://example.test/master" });

    expect(result.customers.map(customer => customer.customerName)).toEqual(["Food trader township", "Trade hub Pia Road", "Baba Latif Johar town", "Nadeem Sb"]);
    expect(result.customers[1]?.sapLines[0]?.qtyPkts).toBe(5);
    expect(result.customers[2]?.sapLines[1]?.qtyPkts).toBe(5);
    expect(result.customers[3]?.warnings[0]).toContain("Order captured from the screenshot");
    expect(invokeLLM.mock.calls[0]?.[0]?.messages[0]?.content).toContain("including the final bubble at the bottom");
    expect(invokeLLM.mock.calls[0]?.[0]?.messages[1]?.content[1]?.image_url.detail).toBe("high");
  });

  it("removes a quoted preview duplicate and keeps V1/V5 outside unchanged strict SAP rows", async () => {
    const quotedReplyResult = JSON.stringify({
      customers: [
        { customerName: "Akraam Store gulbarg", sapLines: [{ fgCode: "FG-03-0018", qtyPkts: 15, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [], placementRoute: "" },
        { customerName: "Akraam Store gulbarg", sapLines: [{ fgCode: "FG-03-0018", qtyPkts: 15, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [], placementRoute: "Please add in V1" },
        { customerName: "Hanif trader", sapLines: [{ fgCode: "FG-03-0018", qtyPkts: 10, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [], placementRoute: "Please add in V5" },
      ],
      generalWarnings: [],
      detectedBubbles: [
        { customerName: "Akraam Store gulbarg", rawOrderText: "3 CTN 70/30 local" },
        { customerName: "Akraam Store gulbarg", rawOrderText: "3 CTN 70/30 local" },
        { customerName: "Hanif trader", rawOrderText: "Local 70 30 2 ctn" },
      ],
    });
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: quotedReplyResult } }] });

    const result = await parseOrderWithAi({ sourceText: "", attachment: { kind: "image", filename: "quoted-orders.png", mimeType: "image/png", dataUrl: "data:image/png;base64,AA==" }, masterUrl: "https://example.test/master" });

    expect(result.customers).toHaveLength(2);
    expect(result.customers[0]).toMatchObject({ customerName: "Akraam Store gulbarg", placementRoute: "V1" });
    expect(result.customers[1]).toMatchObject({ customerName: "Hanif trader", placementRoute: "V5" });
    expect(result.detectedBubbles).toHaveLength(2);
    expect(formatCustomerSapBlock(result.customers[0]!)).toBe("FG-03-0018\t\t15\t\t\t\t\tHO-WH\t\tCHEESE");
    expect(formatCustomerSapBlock(result.customers[1]!)).toBe("FG-03-0018\t\t10\t\t\t\t\tHO-WH\t\tCHEESE");
    expect(invokeLLM.mock.calls[0]?.[0]?.messages[0]?.content).toContain("quoted/replied preview");
  });

  it("creates separate non-zero Broadway branch orders and converts KG into 2KG physical packets", async () => {
    const broadwaySheet = JSON.stringify({
      customers: [
        { customerName: "Dha y Block", sapLines: [{ fgCode: "FG-02-0035", qtyPkts: 11, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [], placementRoute: "" },
        { customerName: "Johar", sapLines: [{ fgCode: "FG-02-0035", qtyPkts: 13, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [], placementRoute: "" },
        { customerName: "Kohinoor City Fsd", sapLines: [{ fgCode: "FG-02-0035", qtyPkts: 0, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [], placementRoute: "" },
      ],
      generalWarnings: [],
      detectedBubbles: [
        { customerName: "Dha y Block", rawOrderText: "Broadway | Dha y Block | KG | 110 | 11 CTN" },
        { customerName: "Johar", rawOrderText: "Broadway | Johar | KG | 130 | 13 CTN" },
        { customerName: "Kohinoor City Fsd", rawOrderText: "Broadway | Kohinoor City Fsd | KG | 0 | 0 CTN" },
      ],
    });
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: broadwaySheet } }] });

    const result = await parseOrderWithAi({ sourceText: "", attachment: { kind: "image", filename: "broadway-branches.png", mimeType: "image/png", dataUrl: "data:image/png;base64,AA==" }, masterUrl: "https://example.test/master" });

    expect(result.customers.map(customer => customer.customerName)).toEqual(["Dha y Block", "Johar"]);
    expect(result.customers.map(customer => customer.sapLines[0]?.qtyPkts)).toEqual([55, 65]);
    expect(result.customers.some(customer => /kohinoor|multan/i.test(customer.customerName))).toBe(false);
    expect(invokeLLM.mock.calls[0]?.[0]?.messages[0]?.content).toContain("BROADWAY MULTI-BRANCH KG ALLOCATION SHEETS");
  });
});
