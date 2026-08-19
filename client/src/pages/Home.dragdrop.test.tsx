// @vitest-environment jsdom
import React from "react";
import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutate = vi.fn();
const invalidate = vi.fn();
const saveMemory = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ orders: { history: { invalidate }, memory: { list: { invalidate } } } }),
    orders: {
      parse: { useMutation: () => ({ mutate, isPending: false, isError: false, error: null }) },
      memory: {
        list: { useQuery: () => ({ data: [] }) },
        add: { useMutation: () => ({ mutate: saveMemory, isPending: false }) },
      },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Home from "./Home";

describe("smart input drag-and-drop", () => {
  beforeEach(() => { mutate.mockClear(); invalidate.mockClear(); saveMemory.mockClear(); });

  it("receives an XLSX file dropped from a downloads folder", async () => {
    render(<Home />);
    const orderSource = screen.getByLabelText("Order source");
    const file = new File(["placeholder spreadsheet"], "whatsapp-order.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    const dropEvent = createEvent.drop(orderSource);
    Object.defineProperty(dropEvent, "dataTransfer", { value: { files: [file], types: ["Files"] } });
    fireEvent(orderSource, dropEvent);

    await waitFor(() => expect(screen.getByText("whatsapp-order.xlsx")).toBeTruthy());
    expect(screen.getByText("Excel order data ready")).toBeTruthy();
  });
});
