import { formatUnits, type RouteMatrix } from "./routeReport";

const trim = (value: string, max: number) => value.length > max ? `${value.slice(0, Math.max(1, max - 1)).trimEnd()}…` : value;
const categoryLabel = (category: string) => category === "all" ? "All categories" : category.replace(/^CFS\s*-\s*/i, "");

export function routeMatrixImageFileName(route: string, category: string) {
  const safe = `${route}-${categoryLabel(category)}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `route-matrix-${safe || "report"}.png`;
}

export async function copyImageToClipboard(blob: Blob, clipboard = navigator.clipboard, ClipboardImageItem = window.ClipboardItem) {
  if (!clipboard?.write || !ClipboardImageItem) return false;
  await clipboard.write([new ClipboardImageItem({ "image/png": blob })]);
  return true;
}

export async function createRouteMatrixImage({ route, category, matrix }: { route: string; category: string; matrix: RouteMatrix }): Promise<Blob> {
  if (matrix.customers.length === 0 || matrix.products.length === 0) throw new Error("Select a route with customer products before creating an image.");
  const customerWidth = 330;
  const unitsWidth = 84;
  const productWidth = Math.max(104, Math.min(138, Math.floor(1700 / matrix.products.length)));
  const headerHeight = 168;
  const rowHeight = 42;
  const footerHeight = 44;
  const width = customerWidth + unitsWidth + matrix.products.length * productWidth;
  const height = headerHeight + (matrix.customers.length + 1) * rowHeight + footerHeight;
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not create the route image.");
  ctx.scale(scale, scale);

  const line = (x1: number, y1: number, x2: number, y2: number, color = "#d7e3d4") => { ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  const text = (value: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(value, x, y); };

  ctx.fillStyle = "#174c37"; ctx.fillRect(0, 0, width, 76);
  text("CHEESE DESK · ROUTE CONFIRMATION MATRIX", 26, 24, "700 12px Arial", "#cfe6cc");
  text(route, 26, 51, "700 26px Arial", "#ffffff");
  text(categoryLabel(category), width - 26, 51, "600 14px Arial", "#e6f4df", "right");
  ctx.fillStyle = "#f4f8f1"; ctx.fillRect(0, 76, width, headerHeight - 76);
  text(`${matrix.customers.length} customers · ${matrix.products.length} ordered products · ${formatUnits(matrix.totalUnits)} total units`, 26, 101, "600 13px Arial", "#355a3d");
  text("Generated for WhatsApp confirmation — quantities are in units", 26, 126, "12px Arial", "#6c7c6f");
  text("Customer", 14, 153, "700 11px Arial", "#254b30");
  text("Units", customerWidth + unitsWidth / 2, 153, "700 10px Arial", "#254b30", "center");
  let productX = customerWidth + unitsWidth;
  matrix.products.forEach(product => {
    text((product.code ?? "").replace("FG-", ""), productX + productWidth / 2, 144, "700 9px Arial", "#53705a", "center");
    text(trim(product.name.replace(/Mozzarella/gi, "Mozz").replace(/Cheddar/gi, "Chedd").replace(/Shredded/gi, "Shred"), 17), productX + productWidth / 2, 157, "700 9px Arial", "#254b30", "center");
    productX += productWidth;
  });
  line(0, headerHeight, width, headerHeight, "#bcd2b9");
  line(customerWidth, headerHeight - 20, customerWidth, height, "#c9dac6");
  line(customerWidth + unitsWidth, headerHeight - 20, customerWidth + unitsWidth, height, "#c9dac6");

  matrix.customers.forEach((customer, rowIndex) => {
    const y = headerHeight + rowIndex * rowHeight;
    ctx.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : "#f9fcf7"; ctx.fillRect(0, y, width, rowHeight);
    const quantities = new Map(customer.products.map(product => [product.code ?? product.name, product.quantity]));
    text(trim(customer.customerName, 39), 14, y + 15, "700 11px Arial", "#203a27");
    text(trim(`${customer.customerCode} · ${categoryLabel(customer.category)}`, 47), 14, y + 30, "9px Arial", "#6f806f");
    text(formatUnits(customer.totalUnits), customerWidth + unitsWidth / 2, y + rowHeight / 2, "700 12px Arial", "#24583a", "center");
    let cellX = customerWidth + unitsWidth;
    matrix.products.forEach(product => {
      const value = quantities.get(product.code ?? product.name) ?? 0;
      text(value > 0 ? formatUnits(value) : "–", cellX + productWidth / 2, y + rowHeight / 2, value > 0 ? "700 12px Arial" : "11px Arial", value > 0 ? "#174f36" : "#b3beb1", "center");
      line(cellX, y, cellX, y + rowHeight, "#e1e9de");
      cellX += productWidth;
    });
    line(0, y + rowHeight, width, y + rowHeight, "#e1e9de");
  });
  const footerY = headerHeight + matrix.customers.length * rowHeight;
  ctx.fillStyle = "#dff0d4"; ctx.fillRect(0, footerY, width, footerHeight);
  text("ROUTE TOTAL", 14, footerY + footerHeight / 2, "700 11px Arial", "#24583a");
  text(formatUnits(matrix.totalUnits), customerWidth + unitsWidth / 2, footerY + footerHeight / 2, "700 12px Arial", "#174f36", "center");
  let totalX = customerWidth + unitsWidth;
  matrix.products.forEach(product => { text(formatUnits(product.totalUnits), totalX + productWidth / 2, footerY + footerHeight / 2, "700 12px Arial", "#174f36", "center"); line(totalX, footerY, totalX, footerY + footerHeight, "#c1dbbc"); totalX += productWidth; });

  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("The matrix image could not be created.")), "image/png"));
}
