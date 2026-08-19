import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeLLM } = vi.hoisted(() => ({ invokeLLM: vi.fn() }));

vi.mock("./_core/llm", () => ({ invokeLLM }));

import { parseOrderWithAi } from "./orderParser";

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
});
