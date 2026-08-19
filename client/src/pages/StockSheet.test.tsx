// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    stock: { generate: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import StockSheet from "./StockSheet";

describe("StockSheet workspace", () => {
  it("renders three independent branch order inputs and waits for all of them before generation", () => {
    render(<StockSheet />);
    expect(screen.getByDisplayValue("Branch 1")).toBeTruthy();
    expect(screen.getByDisplayValue("Branch 2")).toBeTruthy();
    expect(screen.getByDisplayValue("Branch 3")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Generate stock sheet/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
