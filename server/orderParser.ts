import { invokeLLM } from "./_core/llm";
import type { ParsedCustomerOrder, ParsedOrderResult, SapLine } from "../shared/orderTypes";

const FG_CODE_PATTERN = /^FG-\d{2}-\d{4}$/i;
const MAX_CUSTOMERS = 30;
const MAX_LINES_PER_CUSTOMER = 80;
const MASTER_PROMPT_KEY = "Cheese_SAP_Master_Training_Prompt_V4_SAP_ACTUAL_FORMAT_ca7294e2.txt";
let officialMasterCache: { content: string; expiresAt: number } | null = null;

export type ParserAttachment = {
  kind: "image";
  filename: string;
  mimeType: string;
  dataUrl: string;
};

const CHEESE_MASTER_PROMPT = `
You are the Cheese Distribution SAP Order Processing Assistant. Parse WhatsApp order text, Roman Urdu, English order notes, and WhatsApp screenshots into customer-separated SAP orders.

NON-NEGOTIABLE OUTPUT PRINCIPLE:
- One uploaded message or screenshot may contain several customers. Identify every customer section and create a completely separate order block for each customer.
- Never combine, consolidate, mix, or merge quantities across different customers, even when their FG codes are identical.
- Customer names are headings outside SAP rows. Customer names, product names, notes, totals, carton calculations, explanations, labels, and comments must never appear within a SAP line.
- A duplicate FG code may be combined only inside the same customer's order after converting all quantities to SAP PKTS.
- If customer boundaries, product mapping, pack size, or unit are materially ambiguous, do not guess. Return a concise warning for that customer and omit the uncertain line.

SAP FORMAT:
- Each SAP row is strictly: FG_CODE + exactly 2 TAB characters + QTY_PKTS + exactly 5 TAB characters + HO-WH + exactly 2 TAB characters + CHEESE.
- SAP quantity is physical PKTS/PCS/Units, always a positive integer, never CTN and never decimal.
- Use warehouse HO-WH and group CHEESE unless explicitly instructed otherwise.
- The application will render the tab-delimited rows itself. Return structured fields only, never a formatted line, never headers, and never customer names within the line list.

QUANTITY RULES:
- CTN/carton/case must be converted to PKTS using the exact product carton ratio. PCS, units, pkt, and packet use the stated quantity as-is unless the source explicitly says otherwise.
- Do not multiply a source Units/PCS column again. A 200gm sample means exactly 1 PCS.
- Carton ratios: 0.1000 = 10 PCS/CTN; 0.2000 = 5 PCS/CTN; 0.2500 = 4 PCS/CTN; 0.1250 = 8 PCS/CTN; 0.0556 is approximately 18 PCS/CTN when the master row uses that ratio.
- Do not infer a carton factor when it is absent from master data.

NORMALIZATION:
- Achh/Achha/Acha/Accha => Achha; Chadder/Chedar/Cheeder => Cheddar; Shred/Shared/Shrd/Shreded => Shredded; Clasic => Classic; Lockl/Locl => Local; M3 => New 70/30; MF => MF; Pro W => Pro White; Max W => Max White; P.T/PT => PT.
- Treat customer names as headings, not product names.

OFFICIAL HIGH-FREQUENCY MASTER MAPPINGS (check exact weight, style, colour and packaging):
- Achha Mozzarella Shredded White 2KG unbranded: FG-01-0042, normally 10 PCS/CTN.
- Achha Mozzarella Shredded Yellow 1KG: FG-01-0053.
- Achha Mozzarella Dice White 2KG: FG-01-0124, 5 PCS/CTN.
- Achha Mozzarella Dice Yellow 2KG: FG-01-0125, 5 PCS/CTN.
- Local 70/30 2KG: FG-03-0018.
- New/M3 70/30 2KG: FG-02-0051.
- Imported 70/30 2KG: FG-03-0006.
- Verona Shredded 2KG: FG-01-0072; Verona Shredded 1KG: FG-01-0071; Verona Shredded 2KG WP: FG-01-0122.
- Classic Shredded standard 2KG: FG-02-0036; Classic 70/30: FG-02-0072; Classic Cheddar Shredded: FG-02-0066.
- Top Cow Cheddar Shredded: FG-02-0074. SPECIAL TOP COW RULE: for standard Top Cow mozzarella only, treat Shredded/Shred and Dice as equivalent wording. Top Cow White Shredded/Dice 2KG = FG-02-0048; Top Cow Yellow Shredded/Dice 2KG = FG-02-0049. Do not apply this rule when 70/30, Premium, W.Poly, or Block is explicitly stated; use the exact matching master row instead.
- White Slice 1KG: FG-02-0023; White Slice 800GM: FG-02-0037; Yellow Slice 1KG: FG-02-0028; Yellow Slice 800GM: FG-02-0038; Jalapeno Slice: FG-02-0039.
- MF White: 2KG FG-02-0093; 2.5KG FG-02-0102. MF Yellow: 2KG FG-02-0091; 2.5KG FG-02-0104.
- Pro White: 2KG FG-02-0122; 2.5KG FG-02-0106. Pro Yellow: 2KG FG-02-0124; 2.5KG FG-02-0108.
- Max White: 2KG FG-02-0126; 2.5KG FG-02-0110. Max Yellow: 2KG FG-02-0128; 2.5KG FG-02-0112.
- PT White: 2KG FG-02-0134; 2.5KG FG-02-0118. PT Yellow: 2KG FG-02-0136; 2.5KG FG-02-0120.
- VF White: 2KG FG-02-0130; 2.5KG FG-02-0114. VF Yellow: 2KG FG-02-0132; 2.5KG FG-02-0116.
- Allana Mozzarella Shredded White 2KG standard: FG-02-0097; Allana Mozzarella Shredded White 2KG W.Poly: FG-02-0164.
- Allana Gold Mozzarella Shredded White 2KG standard: FG-02-0139; Allana Gold Mozzarella Shredded White 2KG W.Poly: FG-02-0163.
- Allana Pizza 70/30 White Shredded standard: FG-02-0148; Allana Pizza 70/30 White Shredded W.Poly: FG-02-0173.

LOCAL 70/30 PRODUCT-FIRST RECOGNITION — apply before CTN conversion:
- Identify the product style first. For Local 70/30, Shredded/Shred/Shreded (or no style word) means Shredded; Block means Block; Slice/Slices means Slices.
- For Local 70/30 Shredded, use 5 PKTS per CTN/box for the standard 2KG item. The known 2KG shredded FG code is FG-03-0018; use the 1KG master row only when 1KG is explicit.
- For Local 70/30 Block, use 10 PKTS per CTN/box. For Local 70/30 Slices, use 18 PKTS per CTN/box.
- Never report an unknown carton ratio for a recognized Local 70/30 Shredded, Block, or Slice order. Recognize the style first, then apply its carton rule. Keep customer blocks separate.

For a matching official master entry, do not invent, alter, or correct an FG code from memory. Preserve customer-level separation through final validation. Return all answer fields in English or Roman Urdu as appropriate, but maintain SAP values exactly.
`;

async function getOfficialMasterPrompt(masterUrl: string): Promise<string> {
  if (officialMasterCache && officialMasterCache.expiresAt > Date.now()) return officialMasterCache.content;
  const response = await fetch(masterUrl);
  if (!response.ok) throw new Error("The official SAP product master could not be loaded.");
  const content = await response.text();
  if (!content.includes("OFFICIAL 229-ROW ITEM MASTER")) throw new Error("The official SAP product master is incomplete.");
  officialMasterCache = { content, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
  return content;
}

export function formatSapLine(line: SapLine): string {
  return `${line.fgCode}\t\t${line.qtyPkts}\t\t\t\t\t${line.warehouse}\t\t${line.productGroup}`;
}

export function formatCustomerSapBlock(customer: ParsedCustomerOrder): string {
  return customer.sapLines.map(formatSapLine).join("\n");
}

function cleanWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean).slice(0, 8);
}

function normalizeLine(value: unknown): SapLine | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const fgCode = typeof raw.fgCode === "string" ? raw.fgCode.trim().toUpperCase() : "";
  const qtyPkts = typeof raw.qtyPkts === "number" ? raw.qtyPkts : Number(raw.qtyPkts);
  if (!FG_CODE_PATTERN.test(fgCode) || !Number.isInteger(qtyPkts) || qtyPkts <= 0) return null;
  return {
    fgCode,
    qtyPkts,
    warehouse: typeof raw.warehouse === "string" && raw.warehouse.trim() ? raw.warehouse.trim().toUpperCase() : "HO-WH",
    productGroup: typeof raw.productGroup === "string" && raw.productGroup.trim() ? raw.productGroup.trim().toUpperCase() : "CHEESE",
  };
}

export function normalizeParsedOrder(value: unknown): ParsedOrderResult {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawCustomers = Array.isArray(raw.customers) ? raw.customers : [];
  const customers: ParsedCustomerOrder[] = rawCustomers.slice(0, MAX_CUSTOMERS).flatMap((rawCustomer) => {
    if (!rawCustomer || typeof rawCustomer !== "object") return [];
    const customer = rawCustomer as Record<string, unknown>;
    const customerName = typeof customer.customerName === "string" ? customer.customerName.trim() : "";
    const rawLines = Array.isArray(customer.sapLines) ? customer.sapLines : [];
    const mergedLines = new Map<string, SapLine>();
    rawLines.slice(0, MAX_LINES_PER_CUSTOMER).map(normalizeLine).filter((line): line is SapLine => Boolean(line)).forEach((line) => {
      const existing = mergedLines.get(line.fgCode);
      mergedLines.set(line.fgCode, existing ? { ...existing, qtyPkts: existing.qtyPkts + line.qtyPkts } : line);
    });
    if (!customerName || mergedLines.size === 0) return [];
    return [{ customerName, sapLines: Array.from(mergedLines.values()), warnings: cleanWarnings(customer.warnings) }];
  });

  return { customers, generalWarnings: cleanWarnings(raw.generalWarnings) };
}

export function parseValidatedModelResult(content: unknown): ParsedOrderResult | null {
  if (typeof content !== "string") return null;
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const result = normalizeParsedOrder(JSON.parse(trimmed.slice(start, end + 1)));
    return result.customers.length > 0 ? result : null;
  } catch {
    return null;
  }
}

export function needsFullMasterLookup(result: ParsedOrderResult | null): boolean {
  return Boolean(result?.generalWarnings.some(warning => warning.includes("MASTER_LOOKUP_REQUIRED")));
}

export function recognizeLocal7030CartonPkts(sourceText: string): number | undefined {
  const normalized = sourceText.toLowerCase().replace(/\s+/g, " ");
  if (!/local\s*70\s*\/\s*30|local 7030/.test(normalized)) return undefined;
  if (/\bslices?\b/.test(normalized)) return 18;
  if (/\bblock\b/.test(normalized)) return 10;
  return 5;
}

export function calculateLocal7030PktQuantity(sourceText: string): number | undefined {
  const ratio = recognizeLocal7030CartonPkts(sourceText);
  const localLine = sourceText.split(/\r?\n/).find(line => /local\s*70\s*\/\s*30|local 7030/i.test(line)) || sourceText;
  const cartonMatch = localLine.match(/\b(\d+)\s*(?:ctn|carton|box)\b/i);
  if (!ratio || !cartonMatch) return undefined;
  return Number(cartonMatch[1]) * ratio;
}

type Local7030Target = { customerName?: string; qtyPkts: number };

function normalizeCustomerKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function extractLocal7030ShreddedTargets(sourceText: string): Local7030Target[] {
  const lines = sourceText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.flatMap((line, index) => {
    if (!/local\s*70\s*\/\s*30|local 7030/i.test(line) || /\bblock\b|\bslices?\b|\b1\s*kg\b/i.test(line)) return [];
    const qtyPkts = calculateLocal7030PktQuantity(line);
    if (!qtyPkts) return [];
    const customerName = lines.slice(0, index).reverse().find(candidate => !/\b\d+\s*(?:ctn|carton|box)\b|\b(local|70\s*\/\s*30)\b/i.test(candidate));
    return [{ customerName, qtyPkts }];
  });
}

export function enforceLocal7030ShreddedQuantity(result: ParsedOrderResult, sourceText: string): ParsedOrderResult {
  const targets = extractLocal7030ShreddedTargets(sourceText);
  if (!targets.length) return result;
  const quantitiesByCustomer = new Map<string, number>();
  targets.forEach(target => {
    const key = target.customerName ? normalizeCustomerKey(target.customerName) : "";
    quantitiesByCustomer.set(key, (quantitiesByCustomer.get(key) || 0) + target.qtyPkts);
  });

  return {
    ...result,
    customers: result.customers.map(customer => {
      const customerQtyPkts = quantitiesByCustomer.get(normalizeCustomerKey(customer.customerName)) ?? (result.customers.length === 1 && targets.length === 1 ? targets[0]?.qtyPkts : undefined);
      if (!customerQtyPkts) return customer;
      return { ...customer, sapLines: customer.sapLines.map(line => line.fgCode === "FG-03-0018" ? { ...line, qtyPkts: customerQtyPkts } : line) };
    }),
  };
}

export async function parseOrderWithAi(input: { sourceText: string; attachment?: ParserAttachment; masterUrl: string; learnedRules?: string[] }): Promise<ParsedOrderResult> {
  const recognizedLocal7030Ratio = recognizeLocal7030CartonPkts(input.sourceText);
  const calculatedLocal7030Pkts = calculateLocal7030PktQuantity(input.sourceText);
  const local7030Hint = recognizedLocal7030Ratio ? `\n\nPRODUCT-FIRST LOCAL 70/30 HINT: This source contains Local 70/30. Use ${recognizedLocal7030Ratio} PKTS per CTN after identifying its style${calculatedLocal7030Pkts ? `; the stated carton quantity converts to ${calculatedLocal7030Pkts} PKTS` : ""}. Do not report an unknown carton ratio. For Local 70/30 Shredded 2KG, 5 PKTS per CTN is non-negotiable and the server will validate this quantity.` : "";
  const userContent: Array<
    { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "auto" | "high" } }
  > = [
    { type: "text", text: `ORDER SOURCE TEXT:\n${input.sourceText || "No typed text supplied. Read the attached order file."}${local7030Hint}` },
  ];
  if (input.attachment?.kind === "image") userContent.push({ type: "image_url", image_url: { url: input.attachment.dataUrl, detail: "auto" } });

  const responseFormat = {
      type: "json_schema",
      json_schema: {
        name: "sap_order_parse",
        strict: true,
        schema: {
          type: "object",
          properties: {
            customers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  customerName: { type: "string" },
                  sapLines: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        fgCode: { type: "string" }, qtyPkts: { type: "integer" }, warehouse: { type: "string" }, productGroup: { type: "string" },
                      },
                      required: ["fgCode", "qtyPkts", "warehouse", "productGroup"], additionalProperties: false,
                    },
                  },
                  warnings: { type: "array", items: { type: "string" } },
                },
                required: ["customerName", "sapLines", "warnings"], additionalProperties: false,
              },
            },
            generalWarnings: { type: "array", items: { type: "string" } },
          },
          required: ["customers", "generalWarnings"], additionalProperties: false,
        },
      },
  } as const;

  const requestStructuredParse = async (model: "gemini-3-flash-preview" | "gpt-5-mini", useFullMaster: boolean) => {
    const officialMasterPrompt = useFullMaster ? await getOfficialMasterPrompt(input.masterUrl) : "";
    const promptMode = useFullMaster
      ? `CANONICAL OFFICIAL MASTER PROMPT — APPLY THIS IN FULL:\n${officialMasterPrompt}`
      : "FAST PATH: Use the compact mappings above for common items. If any product requires a mapping not covered above, do not guess; include the exact warning token MASTER_LOOKUP_REQUIRED in generalWarnings so the system performs a full-master lookup.";
    const durableMemory = input.learnedRules?.length ? `\n\nDURABLE USER-APPROVED PARSER MEMORY — apply these rules in future orders unless they conflict with the official product master or SAP formatting rules:\n${input.learnedRules.map((rule, index) => `${index + 1}. ${rule}`).join("\n")}` : "";
    const messages = [
      { role: "system" as const, content: `${CHEESE_MASTER_PROMPT}\n\n${promptMode}${durableMemory}` },
      { role: "user" as const, content: userContent },
    ];
    const response = await invokeLLM({ model, messages, response_format: responseFormat, maxTokens: useFullMaster ? 4_000 : 2_200 });
    return parseValidatedModelResult(response.choices[0]?.message?.content);
  };

  const primaryModel = input.attachment?.kind === "image" ? "gemini-3-flash-preview" : "gpt-5-mini";
  const primaryResult = await requestStructuredParse(primaryModel, false);
  if (primaryResult && !needsFullMasterLookup(primaryResult)) return enforceLocal7030ShreddedQuantity(primaryResult, input.sourceText);

  const fallbackModel = primaryModel === "gpt-5-mini" ? "gemini-3-flash-preview" : "gpt-5-mini";
  const retryResult = await requestStructuredParse(fallbackModel, true);
  if (retryResult) return enforceLocal7030ShreddedQuantity(retryResult, input.sourceText);

  throw new Error("This order could not be safely read. Please resend a sharper screenshot or paste the text; no incomplete SAP order was created.");
}
