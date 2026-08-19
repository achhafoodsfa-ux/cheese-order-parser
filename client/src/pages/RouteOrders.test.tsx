// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import RouteOrders from "./RouteOrders";

describe("RouteOrders workspace", () => {
  it("shows one day-end Excel upload entry point and explains its route/category workflow", () => {
    render(<RouteOrders />);
    expect(screen.getByRole("heading", { name: /Route-wise customer orders/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Choose Excel file/i })).toBeTruthy();
    expect(screen.getByText(/The file is read in your browser and is not saved/i)).toBeTruthy();
  });
});
