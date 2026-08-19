export type RouteProduct = {
  code: string | null;
  name: string;
  quantity: number;
};

export type RouteCustomer = {
  id: string;
  route: string;
  category: string;
  customerCode: string;
  customerName: string;
  salesOrders: string[];
  totalUnits: number;
  products: RouteProduct[];
};

export type RouteReport = {
  routes: string[];
  categories: string[];
  customers: RouteCustomer[];
  sourceRows: number;
};

type SheetRow = unknown[];

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const cleanName = (value: string) => value.replace(/\s*\(un-branded\)\s*/gi, "").replace(/\s+/g, " ").trim();

function findColumn(row: SheetRow, candidates: string[]) {
  return row.findIndex(value => candidates.includes(normalize(value)));
}

function numeric(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function productHeader(value: unknown, index: number) {
  const label = String(value ?? "").trim();
  const match = label.match(/^\((FG-[A-Z0-9-]+)\)\s*-\s*(.+)$/i);
  if (match) return { index, code: match[1]!.toUpperCase(), name: cleanName(match[2]!) };
  return null;
}

export function buildRouteReportFromRows(rows: SheetRow[]): RouteReport {
  const customerHeaderRowIndex = rows.findIndex(row => findColumn(row, ["route"]) >= 0 && findColumn(row, ["cst name", "customer name"]) >= 0);
  if (customerHeaderRowIndex < 0) throw new Error("This sheet needs both Route and Cst Name / Customer Name columns.");

  const customerHeader = rows[customerHeaderRowIndex] ?? [];
  const routeIndex = findColumn(customerHeader, ["route"]);
  const categoryIndex = findColumn(customerHeader, ["cst group", "customer group", "category"]);
  const customerNameIndex = findColumn(customerHeader, ["cst name", "customer name"]);
  const customerCodeIndex = findColumn(customerHeader, ["cst code", "customer code"]);
  const salesOrderIndex = findColumn(customerHeader, ["so num", "sales order", "sales order no", "order no"]);

  const productHeaderRowIndex = rows.findIndex((row, index) => index > customerHeaderRowIndex && row.some(value => normalize(value) === "total units") && row.some(value => /^\(FG-/i.test(String(value ?? "").trim())));
  if (productHeaderRowIndex < 0) throw new Error("Product headings were not found. Use the Daily Sales Order Report format with Total Units and FG product columns.");

  const productHeaderRow = rows[productHeaderRowIndex] ?? [];
  const totalUnitsIndex = findColumn(productHeaderRow, ["total units"]);
  const productColumns = productHeaderRow.map(productHeader).filter((product): product is NonNullable<typeof product> => Boolean(product));
  if (productColumns.length === 0) throw new Error("No FG product columns were found in this sheet.");

  const customers = new Map<string, RouteCustomer>();
  let sourceRows = 0;
  rows.slice(productHeaderRowIndex + 1).forEach(row => {
    const route = String(row[routeIndex] ?? "").trim();
    const customerName = String(row[customerNameIndex] ?? "").trim();
    if (!route || !customerName) return;

    const products = productColumns.map(column => ({ code: column.code, name: column.name, quantity: numeric(row[column.index]) })).filter(product => product.quantity > 0);
    if (products.length === 0) return;

    sourceRows += 1;
    const category = categoryIndex >= 0 ? String(row[categoryIndex] ?? "").trim() || "Uncategorized" : "Uncategorized";
    const customerCode = customerCodeIndex >= 0 ? String(row[customerCodeIndex] ?? "").trim() : "";
    const salesOrder = salesOrderIndex >= 0 ? String(row[salesOrderIndex] ?? "").trim() : "";
    const id = `${route.toLowerCase()}::${category.toLowerCase()}::${customerCode.toLowerCase() || customerName.toLowerCase()}`;
    const current = customers.get(id) ?? { id, route, category, customerCode, customerName, salesOrders: [], totalUnits: 0, products: [] };
    if (salesOrder && !current.salesOrders.includes(salesOrder)) current.salesOrders.push(salesOrder);
    current.totalUnits += totalUnitsIndex >= 0 ? numeric(row[totalUnitsIndex]) : products.reduce((sum, product) => sum + product.quantity, 0);
    products.forEach(product => {
      const existing = current.products.find(item => item.code === product.code);
      if (existing) existing.quantity += product.quantity;
      else current.products.push(product);
    });
    customers.set(id, current);
  });

  const customerList = Array.from(customers.values()).map(customer => ({ ...customer, products: customer.products.sort((a, b) => a.name.localeCompare(b.name)), salesOrders: customer.salesOrders.sort() })).sort((a, b) => a.route.localeCompare(b.route) || a.customerName.localeCompare(b.customerName));
  return { routes: Array.from(new Set(customerList.map(customer => customer.route))).sort(), categories: Array.from(new Set(customerList.map(customer => customer.category))).sort(), customers: customerList, sourceRows };
}

export function filterRouteCustomers(report: RouteReport, route: string, category: string) {
  return report.customers.filter(customer => (route === "all" || customer.route === route) && (category === "all" || customer.category === category));
}

export type RouteMatrixProduct = RouteProduct & { totalUnits: number };

export type RouteMatrix = {
  customers: RouteCustomer[];
  products: RouteMatrixProduct[];
  totalUnits: number;
};

export function buildRouteMatrix(customers: RouteCustomer[]): RouteMatrix {
  const totals = new Map<string, RouteMatrixProduct>();
  customers.forEach(customer => customer.products.forEach(product => {
    const key = product.code ?? product.name;
    const existing = totals.get(key);
    if (existing) existing.totalUnits += product.quantity;
    else totals.set(key, { ...product, totalUnits: product.quantity });
  }));
  return {
    customers,
    products: Array.from(totals.values()).sort((a, b) => a.name.localeCompare(b.name)),
    totalUnits: customers.reduce((total, customer) => total + customer.totalUnits, 0),
  };
}

export function formatUnits(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}
