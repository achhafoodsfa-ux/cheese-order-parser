// @vitest-environment jsdom
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let parseOptions: { onSuccess?: (value: any) => Promise<void> | void } | undefined;

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ orders: { history: { invalidate: vi.fn() }, memory: { list: { invalidate: vi.fn() } } } }),
    orders: {
      parse: { useMutation: (options: any) => { parseOptions = options; return { mutate: vi.fn(), isPending: false, isError: false, error: null }; } },
      memory: { list: { useQuery: () => ({ data: [] }) }, add: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Home from "./Home";

describe("successful parse reset", () => {
  it("clears the source input while keeping the SAP output visible", async () => {
    render(<Home />);
    const source = screen.getByPlaceholderText(/Paste WhatsApp text/i) as HTMLTextAreaElement;
    fireEvent.change(source, { target: { value: "Babar Ali\nMF White 30" } });

    await act(async () => {
      await parseOptions?.onSuccess?.({
        customers: [{ customerName: "Babar Ali", sapLines: [{ fgCode: "FG-02-0093", qtyPkts: 30, warehouse: "HO-WH", productGroup: "CHEESE" }], warnings: [] }],
        generalWarnings: [], sessionId: 1, createdAt: new Date(),
      });
    });

    expect(source.value).toBe("");
    expect(screen.getByText("Babar Ali")).toBeTruthy();
  });
});
