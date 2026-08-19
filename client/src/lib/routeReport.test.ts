import { describe, expect, it } from "vitest";
import { buildRouteMatrix, buildRouteReportFromRows, filterRouteCustomers } from "./routeReport";

const sourceRows = [
  ["SO Num", "Cst Code", "Cst Name", "Cst Group", "Route", "", "Total Units", "", ""],
  [],
  ["", "", "", "", "", "", "Total Units", "(FG-01-0006) - Achha Mozzarella Block 2 KG (Un-Branded)", "(FG-03-0018) - Local 70/30 Mozzarella/Cheddar Shredded 2 KG (Un-Branded)"],
  ["1001", "C001", "Alpha Foods", "CFS - Corporate", "V1-Lahore", "", "5", "2", "3"],
  ["1002", "C001", "Alpha Foods", "CFS - Corporate", "V1-Lahore", "", "1", "1", "0"],
  ["1003", "C002", "Bravo Traders", "CFS - Distributer", "V2-Lahore", "", "4", "0", "4"],
];

describe("route report spreadsheet grouping", () => {
  it("groups customer rows by route and category and aggregates their product quantities", () => {
    const report = buildRouteReportFromRows(sourceRows);
    const alpha = report.customers.find(customer => customer.customerName === "Alpha Foods");
    expect(report.routes).toEqual(["V1-Lahore", "V2-Lahore"]);
    expect(report.categories).toEqual(["CFS - Corporate", "CFS - Distributer"]);
    expect(alpha).toMatchObject({ route: "V1-Lahore", category: "CFS - Corporate", totalUnits: 6, salesOrders: ["1001", "1002"] });
    expect(alpha?.products).toEqual(expect.arrayContaining([{ code: "FG-01-0006", name: "Achha Mozzarella Block 2 KG", quantity: 3 }, { code: "FG-03-0018", name: "Local 70/30 Mozzarella/Cheddar Shredded 2 KG", quantity: 3 }]));
  });

  it("filters the shareable customer view by both route and customer category", () => {
    const report = buildRouteReportFromRows(sourceRows);
    expect(filterRouteCustomers(report, "V1-Lahore", "CFS - Corporate").map(customer => customer.customerName)).toEqual(["Alpha Foods"]);
    expect(filterRouteCustomers(report, "V1-Lahore", "CFS - Distributer")).toEqual([]);
  });

  it("creates one compact matrix with only the products ordered in the selected route", () => {
    const report = buildRouteReportFromRows(sourceRows);
    const matrix = buildRouteMatrix(filterRouteCustomers(report, "V1-Lahore", "all"));
    expect(matrix.customers).toHaveLength(1);
    expect(matrix.totalUnits).toBe(6);
    expect(matrix.products).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "FG-01-0006", totalUnits: 3 }),
      expect.objectContaining({ code: "FG-03-0018", totalUnits: 3 }),
    ]));
  });

  it("explains when a sheet does not contain the required route/customer columns", () => {
    expect(() => buildRouteReportFromRows([["Customer", "Product"]])).toThrow(/Route and Cst Name/i);
  });
});
