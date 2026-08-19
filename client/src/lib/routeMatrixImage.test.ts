// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRouteMatrixImage, routeMatrixImageFileName } from "./routeMatrixImage";

const matrix = {
  customers: [{ id: "v1::alpha", route: "V1-Lahore", category: "CFS - Corporate", customerCode: "C001", customerName: "Alpha Foods", salesOrders: ["1001"], totalUnits: 5, products: [{ code: "FG-01-0006", name: "Achha Mozzarella Block 2 KG", quantity: 5 }] }],
  products: [{ code: "FG-01-0006", name: "Achha Mozzarella Block 2 KG", quantity: 5, totalUnits: 5 }],
  totalUnits: 5,
};

afterEach(() => vi.restoreAllMocks());

describe("route matrix image sharing", () => {
  it("uses a WhatsApp-friendly image filename for the selected route and category", () => {
    expect(routeMatrixImageFileName("V1-Lahore", "CFS - Corporate")).toBe("route-matrix-v1-lahore-corporate.png");
    expect(routeMatrixImageFileName("Self Pickup", "all")).toBe("route-matrix-self-pickup-all-categories.png");
  });

  it("renders the selected matrix into a PNG blob for native sharing or download", async () => {
    const context = { scale: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), set fillStyle(_: string) {}, set strokeStyle(_: string) {}, set lineWidth(_: number) {}, set font(_: string) {}, set textAlign(_: CanvasTextAlign) {}, set textBaseline(_: CanvasTextBaseline) {} } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback?.(new Blob(["route-matrix"], { type: "image/png" })));
    const blob = await createRouteMatrixImage({ route: "V1-Lahore", category: "CFS - Corporate", matrix });
    expect(blob.type).toBe("image/png");
    expect(context.fillText).toHaveBeenCalledWith("V1-Lahore", 26, 51);
  });
});
