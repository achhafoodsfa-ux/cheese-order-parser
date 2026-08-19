// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ orders: { history: { invalidate: vi.fn() }, memory: { list: { invalidate: vi.fn() } } } }),
    orders: {
      parse: { useMutation: () => ({ mutate: vi.fn(), isPending: true, isError: false, error: null }) },
      memory: { list: { useQuery: () => ({ data: [] }) }, add: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Home from "./Home";

describe("parsing progress", () => {
  it("shows a clear progress state while the AI parser is working", () => {
    render(<Home />);
    expect(screen.getByText("Building SAP orders…")).toBeTruthy();
    expect(screen.getByText("Reading file, separating customers, validating SAP lines")).toBeTruthy();
  });
});
