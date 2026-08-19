// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    stock: { generateUnified: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import StockSheet from "./StockSheet";

describe("StockSheet workspace", () => {
  it("renders one unified smart input and waits for an order before generation", () => {
    render(<StockSheet />);
    expect(screen.getByPlaceholderText(/Paste all 3 branch WhatsApp orders/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Generate sheet/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
