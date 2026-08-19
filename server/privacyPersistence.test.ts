import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const navigationSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("privacy-first parser persistence", () => {
  it("does not save ordinary parses, source files, or generated stock sheets", () => {
    expect(routerSource).not.toContain("storagePut");
    expect(routerSource).not.toContain("createOrderSession");
    expect(routerSource).not.toContain("listOrderSessions");
    expect(routerSource).not.toContain("getOrderSessionById");
    expect(routerSource).toContain("sessionId: null");
    expect(routerSource).toContain("downloadDataUrl");
  });

  it("keeps only explicit permanent-learning rules and removes the history workspace", () => {
    expect(routerSource).toContain("createParserMemory");
    expect(routerSource).toContain("listParserMemories");
    expect(appSource).not.toContain('path="/history"');
    expect(navigationSource).not.toContain("Order history");
  });
});
