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
    expect(invokeLLM.mock.calls[0]?.[0]).toMatchObject({ model: "gemini-3-flash-preview" });
    expect(invokeLLM.mock.calls[1]?.[0]).toMatchObject({ model: "gpt-5-mini" });
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
});
