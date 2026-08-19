import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createOrderSession, getOrderSessionById, listOrderSessions } from "./db";
import { parseOrderWithAi } from "./orderParser";
import { storagePut } from "./storage";

const imageInput = z.object({
  filename: z.string().min(1).max(140),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(7_000_000),
});

function imageBuffer(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
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
    parse: protectedProcedure.input(z.object({ sourceText: z.string().max(30_000).default(""), image: imageInput.optional() }).refine(input => input.sourceText.trim().length > 0 || input.image, { message: "Paste order text or attach a screenshot." })).mutation(async ({ ctx, input }) => {
      let sourceImageKey: string | undefined;
      let sourceImageUrl: string | undefined;
      if (input.image) {
        const extension = input.image.mimeType.split("/")[1];
        const safeName = input.image.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 90);
        const stored = await storagePut(`orders/${ctx.user.id}/${Date.now()}-${safeName || `whatsapp-order.${extension}`}`, imageBuffer(input.image.dataUrl), input.image.mimeType);
        sourceImageKey = stored.key;
        sourceImageUrl = stored.url;
      }
      const forwardedProtocol = ctx.req.headers["x-forwarded-proto"]?.toString().split(",")[0];
      const protocol = forwardedProtocol || ctx.req.protocol || "https";
      const host = ctx.req.get("host");
      if (!host) throw new Error("Unable to resolve the project storage route.");
      const masterUrl = `${protocol}://${host}/manus-storage/Cheese_SAP_Master_Training_Prompt_V4_SAP_ACTUAL_FORMAT_ca7294e2.txt`;
      const parsed = await parseOrderWithAi({ sourceText: input.sourceText.trim(), imageDataUrl: input.image?.dataUrl, masterUrl });
      const session = await createOrderSession({ userId: ctx.user.id, sourceText: input.sourceText.trim() || null, sourceImageKey: sourceImageKey ?? null, sourceImageUrl: sourceImageUrl ?? null, customers: parsed.customers, generalWarnings: parsed.generalWarnings });
      return { ...parsed, sessionId: session?.id ?? null, createdAt: session?.createdAt ?? new Date() };
    }),
    history: protectedProcedure.query(({ ctx }) => listOrderSessions(ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const session = await getOrderSessionById(ctx.user.id, input.id);
      if (!session) throw new Error("Saved order not found.");
      return session;
    }),
  }),
});

export type AppRouter = typeof appRouter;
