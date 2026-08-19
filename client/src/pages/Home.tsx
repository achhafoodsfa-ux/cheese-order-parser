import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { customerSapRows, visibleSapLine } from "@/lib/sapFormat";
import { trpc } from "@/lib/trpc";
import type { ParsedCustomerOrder, ParsedOrderResult } from "@shared/orderTypes";
import { Check, Clipboard, FileImage, ImagePlus, Loader2, Sparkles, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type ParseScreenResult = ParsedOrderResult & { sessionId: number | null; createdAt: Date };
type PendingImage = { filename: string; mimeType: "image/jpeg" | "image/png" | "image/webp"; dataUrl: string };

export default function Home() {
  const [sourceText, setSourceText] = useState("");
  const [image, setImage] = useState<PendingImage | null>(null);
  const [result, setResult] = useState<ParseScreenResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const parse = trpc.orders.parse.useMutation({
    onSuccess: async (parsed) => { setResult(parsed); await utils.orders.history.invalidate(); toast.success(`${parsed.customers.length} customer ${parsed.customers.length === 1 ? "order is" : "orders are"} ready.`); },
    onError: error => toast.error(error.message || "The order could not be parsed. Please try again."),
  });

  const selectImage = (file?: File) => {
    if (!file) return;
    if (!(["image/jpeg", "image/png", "image/webp"] as const).includes(file.type as PendingImage["mimeType"])) { toast.error("Please attach a JPG, PNG, or WEBP screenshot."); return; }
    if (file.size > 4_800_000) { toast.error("Use a screenshot smaller than 4.8 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setImage({ filename: file.name, mimeType: file.type as PendingImage["mimeType"], dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const runParse = () => parse.mutate({ sourceText, ...(image ? { image } : {}) });

  return <div className="mx-auto max-w-[1480px] text-[#1d2b22]">
    <header className="mb-8 flex flex-col gap-5 border-b border-[#e5e4dc] pb-7 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="mb-3 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#9ac55c]" /><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#607266]">SAP operations console</span></div><h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-[38px]">Parse order, <span className="text-[#467752]">preserve every customer.</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#687067]">Paste WhatsApp order text or attach a screenshot. The parser resolves SAP lines while keeping every customer order separate.</p></div>
      <div className="flex items-center gap-3 rounded-2xl border border-[#e3e3dc] bg-white px-4 py-3 shadow-sm"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf4d9] text-[#467752]"><Sparkles className="h-4 w-4" /></div><div><p className="text-xs font-semibold">Strict SAP output</p><p className="text-[11px] text-[#758077]">Customer heading stays outside the rows</p></div></div>
    </header>

    <div className="grid gap-7 xl:grid-cols-[minmax(0,0.93fr)_minmax(0,1.07fr)]">
      <section aria-label="Order source" className="rounded-[26px] border border-[#e4e4dd] bg-white p-5 shadow-[0_14px_45px_-32px_rgba(26,49,32,0.34)] sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#6c7b6e]">01 · Source</p><h2 className="mt-2 text-xl font-semibold tracking-tight">Add a WhatsApp order</h2><p className="mt-2 text-sm leading-5 text-[#717970]">Use text, a screenshot, or both for additional clarity.</p></div><Badge className="rounded-lg bg-[#f1f4ed] px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] text-[#52705a] hover:bg-[#f1f4ed]">AI READY</Badge></div>
        <div className="mt-7"><label htmlFor="order-text" className="mb-2 block text-sm font-medium text-[#354338]">Order text</label><Textarea id="order-text" value={sourceText} onChange={event => setSourceText(event.target.value)} placeholder={'Example: customer name + products\nBabar Ali\n4 ctn achha shred\nMF white 30'} className="min-h-[220px] resize-y rounded-2xl border-[#deded6] bg-[#fbfbf9] p-4 font-mono text-[13px] leading-6 text-[#2b392e] placeholder:text-[#a2a9a1] focus-visible:border-[#6b9956] focus-visible:ring-[#d6eac5]" /></div>
        <div className="mt-5"><div className="mb-2 flex items-center justify-between"><label className="text-sm font-medium text-[#354338]">WhatsApp screenshot</label><span className="text-[11px] text-[#889188]">JPG, PNG or WEBP · max 4.8 MB</span></div><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => selectImage(event.target.files?.[0])} />
          {image ? <div className="flex items-center gap-4 rounded-2xl border border-[#cfe3c0] bg-[#f7fbf1] p-3"><img src={image.dataUrl} alt="Selected WhatsApp screenshot" className="h-16 w-16 rounded-xl border border-[#dfe7d8] object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{image.filename}</p><p className="mt-1 text-xs text-[#6f7f6f]">Ready for visual parsing</p></div><Button size="icon" variant="ghost" onClick={() => setImage(null)} className="shrink-0 rounded-xl text-[#6d776e] hover:bg-[#e9f0e5] hover:text-[#254f38]"><X className="h-4 w-4" /></Button></div> : <button onClick={() => inputRef.current?.click()} className="flex min-h-[116px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#cfd6cc] bg-[#fafbf8] px-6 text-center transition hover:border-[#83a972] hover:bg-[#f5faef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ba369]"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#527d5b] shadow-sm"><ImagePlus className="h-5 w-5" /></div><p className="mt-3 text-sm font-semibold text-[#405044]">Attach WhatsApp screenshot</p><p className="mt-1 text-xs text-[#7d877e]">Clear, full-length screenshots give the best result</p></button>}
        </div>
        <Button onClick={runParse} disabled={parse.isPending || (!sourceText.trim() && !image)} className="mt-7 h-12 w-full rounded-xl bg-[#124e37] text-[15px] font-semibold shadow-[0_12px_22px_-14px_rgba(18,78,55,0.7)] transition hover:bg-[#0e402e] active:scale-[0.98] disabled:bg-[#aeb8ae]"><>{parse.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />} {parse.isPending ? "Parsing order…" : "Parse into SAP orders"}</></Button>
        {parse.isError && <p className="mt-3 rounded-xl bg-[#fff1ed] px-3 py-2 text-xs leading-5 text-[#9b3b27]">{parse.error.message}</p>}
      </section>

      <section aria-label="Parsed SAP orders" className="rounded-[26px] border border-[#e4e4dd] bg-[#fbfcf9] p-5 shadow-[0_14px_45px_-32px_rgba(26,49,32,0.26)] sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5e7df] pb-5"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#6c7b6e]">02 · Output</p><h2 className="mt-2 text-xl font-semibold tracking-tight">Customer-separated SAP lines</h2></div>{result && <Badge className="rounded-lg bg-[#e9f4dd] px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] text-[#47703d] hover:bg-[#e9f4dd]">{result.customers.length} CUSTOMER{result.customers.length !== 1 ? "S" : ""}</Badge>}</div>
        {!result && <div className="flex min-h-[415px] flex-col items-center justify-center px-8 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#e4e9df] bg-white text-[#77a264] shadow-sm"><FileImage className="h-7 w-7" /></div><h3 className="mt-5 text-base font-semibold">Your SAP blocks will appear here</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[#788078]">Each customer receives their own labeled block. Only the exact SAP rows are copied—no names or notes come along.</p></div>}
        {result && <div className="mt-5 space-y-4">
          {result.generalWarnings.map((warning, index) => <p key={`${warning}-${index}`} className="rounded-xl border border-[#f1ddac] bg-[#fff9e7] px-3 py-2 text-xs leading-5 text-[#896c29]">{warning}</p>)}
          {result.customers.map((customer, index) => <CustomerBlock customer={customer} index={index} key={`${customer.customerName}-${index}`} />)}
        </div>}
      </section>
    </div>
  </div>;
}

function CustomerBlock({ customer, index }: { customer: ParsedCustomerOrder; index: number }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(customerSapRows(customer));
    setCopied(true); toast.success(`SAP rows copied for ${customer.customerName}`); window.setTimeout(() => setCopied(false), 1800);
  };
  return <Card className="overflow-hidden rounded-2xl border-[#dfe5da] bg-white shadow-none"><CardContent className="p-0"><div className="flex flex-col gap-3 border-b border-[#e8ebe4] bg-[#f5f8f2] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#dceccb] text-[11px] font-bold text-[#355d3d]">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#263729]">{customer.customerName}</p><p className="mt-0.5 text-[11px] text-[#788478]">Customer heading · outside SAP rows</p></div></div><Button onClick={copy} variant="outline" size="sm" className="h-9 shrink-0 rounded-lg border-[#cbdac4] bg-white text-xs font-semibold text-[#2e5b3b] hover:bg-[#eef6e8]">{copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Clipboard className="mr-1.5 h-3.5 w-3.5" />}{copied ? "Copied" : "Copy SAP lines"}</Button></div>
    <div className="p-4"><div className="space-y-2 font-mono text-[12px] leading-5 text-[#34503c]">{customer.sapLines.map((line, lineIndex) => <div key={`${line.fgCode}-${lineIndex}`} className="rounded-lg bg-[#f8faf6] px-3 py-2">{visibleSapLine(line)}</div>)}</div>{customer.warnings.length > 0 && <div className="mt-3 space-y-1">{customer.warnings.map((warning, warningIndex) => <p key={`${warning}-${warningIndex}`} className="text-xs leading-5 text-[#99662d]">{warning}</p>)}</div>}</div></CardContent></Card>;
}
