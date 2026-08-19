// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const parseMutate = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ orders: { history: { invalidate: vi.fn() }, memory: { list: { invalidate: vi.fn() } } } }),
    orders: {
      parse: { useMutation: () => ({ mutate: parseMutate, isPending: false, isError: false, error: null }) },
      memory: { list: { useQuery: () => ({ data: [] }) }, add: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Home from "./Home";

describe("smart-input keyboard submission", () => {
  it("submits on Enter and preserves Shift+Enter for a new line", () => {
    parseMutate.mockClear();
    render(<Home />);
    const source = screen.getByPlaceholderText(/Paste WhatsApp text/i);
    fireEvent.change(source, { target: { value: "Customer A\nAchha Moz blk 5 blk" } });
    fireEvent.keyDown(source, { key: "Enter" });
    expect(parseMutate).toHaveBeenCalledWith({ sourceText: "Customer A\nAchha Moz blk 5 blk" });
    fireEvent.keyDown(source, { key: "Enter", shiftKey: true });
    expect(parseMutate).toHaveBeenCalledTimes(1);
  });
});
