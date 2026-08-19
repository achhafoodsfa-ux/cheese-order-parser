import { z } from "zod";
// The upstream package does not publish a declaration for its side-effect-free parser entry point.
// @ts-ignore
import pdf from "pdf-parse/lib/pdf-parse.js";
import * as XLSX from "xlsx";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createOrderSession, createParserMemory, deleteParserMemory, getOrderSessionById, listOrderSessions, listParserMemories } from "./db";
import { parseOrderWithAi, type ParserAttachment } from "./orderParser";
import { storagePut } from "./storage";

const attachmentInput = z.object({
  filename: z.string().min(1).max(140),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"]),
  dataUrl: z.string().regex(/^data:(image\/(jpeg|png|webp)|application\/pdf|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel);base64,/).max(13_000_000),
});

function attachmentBuffer(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

export function spreadsheetToOrderText(dataUrl: string, filename: string): string {
  const workbook = XLSX.read(attachmentBuffer(dataUrl), { type: "buffer", cellText: true, cellDates: true });
  const sheets = workbook.SheetNames.slice(0, 8).map((name) => {
    const sheet = workbook.Sheets[name];
    return `SHEET: ${name}\n${XLSX.utils.sheet_to_csv(sheet, { blankrows: false })}`;
  }).filter(Boolean);
  const text = sheets.join("\n\n").trim().slice(0, 55_000);
  if (!text) throw new Error(`No readable order rows were found in ${filename}.`);
  return `ATTACHED EXCEL ORDER FILE: ${filename}\nRead the following sheet data as the order source. If a Units/PCS column exists, use it as SAP quantity and do not multiply it again.\n\n${text}`;
}

export async function pdfToOrderText(dataUrl: string, filename: string): Promise<string> {
  const parsed = await pdf(attachmentBuffer(dataUrl));
  const text = parsed.text.replace(/\u0000/g, " ").trim().slice(0, 55_000);
  if (!text) throw new Error(`No readable order text was found in ${filename}. Please upload a text-based PDF or paste the order text.`);
  return `ATTACHED PDF ORDER FILE: ${filename}\nRead the following extracted PDF text as the order source.\n\n${text}`;
}

export function attachmentKind(mimeType: string): "image" | "pdf" | "xlsx" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "xlsx";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  orders: router({
    parse: protectedProcedure.input(z.object({ sourceText: z.string().max(30_000).default(""), attachment: attachmentInput.optional() }).refine(input => input.sourceText.trim().length > 0 || input.attachment, { message: "Paste an order or add an image, PDF, or XLSX file." })).mutation(async ({ ctx, input }) => {
      let sourceImageKey: string | undefined;
      let sourceImageUrl: string | undefined;
      const kind = input.attachment ? attachmentKind(input.attachment.mimeType) : undefined;
      if (input.attachment) {
        const extension = input.attachment.filename.split(".").pop() || input.attachment.mimeType.split("/")[1];
        const safeName = input.attachment.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 90);
        const stored = await storagePut(`orders/${ctx.user.id}/${Date.now()}-${safeName || `order-file.${extension}`}`, attachmentBuffer(input.attachment.dataUrl), input.attachment.mimeType);
        sourceImageKey = stored.key;
        sourceImageUrl = stored.url;
      }
      const forwardedProtocol = ctx.req.headers["x-forwarded-proto"]?.toString().split(",")[0];
      const protocol = forwardedProtocol || ctx.req.protocol || "https";
      const host = ctx.req.get("host");
      if (!host) throw new Error("Unable to resolve the project storage route.");
      const masterUrl = `${protocol}://${host}/manus-storage/Cheese_SAP_Master_Training_Prompt_V4_SAP_ACTUAL_FORMAT_ca7294e2.txt`;
      const extractedFileText = kind === "xlsx" && input.attachment ? spreadsheetToOrderText(input.attachment.dataUrl, input.attachment.filename) : kind === "pdf" && input.attachment ? await pdfToOrderText(input.attachment.dataUrl, input.attachment.filename) : "";
      const sourceText = [input.sourceText.trim(), extractedFileText].filter(Boolean).join("\n\n");
      const parserAttachment: ParserAttachment | undefined = input.attachment && kind === "image" ? { kind, filename: input.attachment.filename, mimeType: input.attachment.mimeType, dataUrl: input.attachment.dataUrl } : undefined;
      const learnedRules = (await listParserMemories(ctx.user.id)).map(memory => memory.instruction);
      const parsed = await parseOrderWithAi({ sourceText, attachment: parserAttachment, masterUrl, learnedRules });
      const session = await createOrderSession({ userId: ctx.user.id, sourceText: input.sourceText.trim() || (input.attachment ? `Attached file: ${input.attachment.filename}` : null), sourceImageKey: sourceImageKey ?? null, sourceImageUrl: sourceImageUrl ?? null, customers: parsed.customers, generalWarnings: parsed.generalWarnings });
      return { ...parsed, sessionId: session?.id ?? null, createdAt: session?.createdAt ?? new Date() };
    }),
    history: protectedProcedure.query(({ ctx }) => listOrderSessions(ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const session = await getOrderSessionById(ctx.user.id, input.id);
      if (!session) throw new Error("Saved order not found.");
      return session;
    }),
    memory: router({
      list: protectedProcedure.query(({ ctx }) => listParserMemories(ctx.user.id)),
      add: protectedProcedure.input(z.object({ instruction: z.string().trim().min(8).max(1_200) })).mutation(async ({ ctx, input }) => {
        const memory = await createParserMemory({ userId: ctx.user.id, instruction: input.instruction });
        if (!memory) throw new Error("The rule could not be saved. Please try again.");
        return memory;
      }),
      remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const removed = await deleteParserMemory(ctx.user.id, input.id);
        if (!removed) throw new Error("Saved rule not found.");
        return { success: true } as const;
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
