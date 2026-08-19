import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { customerSapRows, visibleSapLine } from "@/lib/sapFormat";
import { trpc } from "@/lib/trpc";
import type { ParsedCustomerOrder, ParsedOrderResult } from "@shared/orderTypes";
import { Check, Clipboard, FileImage, FileSpreadsheet, FileText, Loader2, Paperclip, Send, Sparkles, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type ParseScreenResult = ParsedOrderResult & { sessionId: number | null; createdAt: Date };
type AttachmentMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | "application/vnd.ms-excel";
type PendingAttachment = { filename: string; mimeType: AttachmentMime; dataUrl: string; kind: "image" | "pdf" | "xlsx" };

export default function Home() {
  const [sourceText, setSourceText] = useState("");
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [result, setResult] = useState<ParseScreenResult | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [newMemory, setNewMemory] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const utils = trpc.useUtils();
  const parse = trpc.orders.parse.useMutation({
    onSuccess: async (parsed) => { setProgress(100); setResult(parsed); setSourceText(""); setAttachment(null); await utils.orders.history.invalidate(); toast.success(`${parsed.customers.length} customer ${parsed.customers.length === 1 ? "order is" : "orders are"} ready.`); window.setTimeout(() => setProgress(0), 700); },
    onError: error => toast.error(error.message || "The order could not be parsed. Please try again."),
  });
  const memories = trpc.orders.memory.list.useQuery();
  const saveMemory = trpc.orders.memory.add.useMutation({
    onSuccess: async () => { setNewMemory(""); await utils.orders.memory.list.invalidate(); toast.success("Rule saved. Future orders will use it."); },
    onError: error => toast.error(error.message || "The rule could not be saved."),
  });

  useEffect(() => {
    if (!parse.isPending) return;
    setProgress(12);
    const checkpoints = [32, 56, 74, 88];
    let index = 0;
    const timer = window.setInterval(() => { setProgress(current => Math.max(current, checkpoints[index++] ?? 88)); }, 850);
    return () => window.clearInterval(timer);
  }, [parse.isPending]);

  const selectAttachment = (file?: File) => {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    const fallbackMime = extension === "pdf" ? "application/pdf" : extension === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : extension === "xls" ? "application/vnd.ms-excel" : undefined;
    const mimeType = (file.type || fallbackMime) as AttachmentMime | undefined;
    const allowed: AttachmentMime[] = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"];
    if (!mimeType || !allowed.includes(mimeType)) { toast.error("Use an image, PDF, XLSX, or XLS order file."); return; }
    if (file.size > 9_000_000) { toast.error("Use a file smaller than 9 MB."); return; }
    const kind = mimeType.startsWith("image/") ? "image" : mimeType === "application/pdf" ? "pdf" : "xlsx";
    const reader = new FileReader();
    reader.onload = () => setAttachment({ filename: file.name, mimeType, dataUrl: String(reader.result), kind });
    reader.readAsDataURL(file);
  };

  const runParse = () => parse.mutate({ sourceText, ...(attachment ? { attachment: { filename: attachment.filename, mimeType: attachment.mimeType, dataUrl: attachment.dataUrl } } : {}) });
  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.dataTransfer.types.includes("Files") && event.dataTransfer.files.length === 0) return;
    dragDepth.current += 1;
    setIsDragActive(true);
  };
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) { dragDepth.current = 0; setIsDragActive(false); }
  };
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragActive(false);
    selectAttachment(event.dataTransfer.files?.[0]);
  };

  return <div className="mx-auto max-w-[1480px] text-[#1d2b22]">
    <header className="mb-8 flex flex-col gap-5 border-b border-[#e5e4dc] pb-7 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="mb-3 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#9ac55c]" /><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#607266]">SAP operations console</span></div><h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-[38px]">Parse order, <span className="text-[#467752]">preserve every customer.</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#687067]">One smart box for WhatsApp text, screenshots, PDFs, and Excel orders. Every customer stays separate.</p></div>
      <div className="flex items-center gap-3 rounded-2xl border border-[#e3e3dc] bg-white px-4 py-3 shadow-sm"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf4d9] text-[#467752]"><Sparkles className="h-4 w-4" /></div><div><p className="text-xs font-semibold">Strict SAP output</p><p className="text-[11px] text-[#758077]">Customer heading stays outside the rows</p></div></div>
    </header>

    <div className="grid gap-7 xl:grid-cols-[minmax(0,0.93fr)_minmax(0,1.07fr)]">
      <section aria-label="Order source" onDragEnter={handleDragEnter} onDragOver={event => event.preventDefault()} onDragLeave={handleDragLeave} onDrop={handleDrop} className="self-start rounded-[26px] border border-[#e4e4dd] bg-white p-5 shadow-[0_14px_45px_-32px_rgba(26,49,32,0.34)] sm:p-7">
        <div className={`relative rounded-[22px] border bg-[#fafbf8] p-2 shadow-inner transition focus-within:ring-4 focus-within:ring-[#dcebd0] ${isDragActive ? "border-[#6d9d5d] ring-4 ring-[#dcebd0]" : "border-[#d9ded5] focus-within:border-[#79a568]"}`}>
          {isDragActive && <div className="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center rounded-[17px] border-2 border-dashed border-[#6c995b] bg-[#eff8e7]/95 text-center shadow-sm"><Paperclip className="h-6 w-6 text-[#416c47]" /><p className="mt-2 text-sm font-semibold text-[#31583a]">Drop order file here</p><p className="mt-1 text-xs text-[#627c66]">Image, PDF, XLSX or XLS</p></div>}
          {parse.isPending && <div className="absolute inset-2 z-30 flex flex-col items-center justify-center rounded-[17px] bg-[#f7fbf2]/95 px-8 text-center backdrop-blur-sm"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e4f0d8] text-[#356b42]"><Loader2 className="h-5 w-5 animate-spin" /></div><p className="mt-4 text-sm font-semibold text-[#264b31]">Building SAP orders…</p><p className="mt-1 text-xs text-[#6b7c6d]">Reading file, separating customers, validating SAP lines</p><Progress value={progress} className="mt-5 h-2 w-full max-w-sm bg-[#dfe9d9]" /></div>}
          <Textarea id="order-text" value={sourceText} onChange={event => setSourceText(event.target.value)} onPaste={event => { const file = event.clipboardData.files[0]; if (file) { event.preventDefault(); selectAttachment(file); } }} placeholder={'Paste WhatsApp text here, or paste a screenshot.\n\nExample:\nBabar Ali\n4 ctn achha shred\nMF white 30'} className="min-h-[224px] resize-y border-0 bg-transparent p-4 font-mono text-[13px] leading-6 text-[#2b392e] placeholder:text-[#a2a9a1] focus-visible:ring-0" />
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.xlsx,.xls" className="hidden" onChange={event => selectAttachment(event.target.files?.[0])} />
          {attachment && <div className="mx-2 mb-2 flex items-center gap-3 rounded-xl border border-[#d5e5c9] bg-[#f3f8ed] p-2.5">{attachment.kind === "image" ? <img src={attachment.dataUrl} alt="Selected order attachment" className="h-10 w-10 rounded-lg object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#467752]">{attachment.kind === "pdf" ? <FileText className="h-5 w-5" /> : <FileSpreadsheet className="h-5 w-5" />}</div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{attachment.filename}</p><p className="mt-0.5 text-[11px] text-[#667867]">{attachment.kind === "xlsx" ? "Excel order data ready" : attachment.kind === "pdf" ? "PDF ready for parsing" : "Image ready for parsing"}</p></div><Button size="icon" variant="ghost" onClick={() => setAttachment(null)} className="h-8 w-8 rounded-lg text-[#6d776e] hover:bg-white hover:text-[#254f38]"><X className="h-4 w-4" /></Button></div>}
          <div className="flex items-center justify-between gap-3 border-t border-[#e4e8e0] px-2 pt-2"><Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()} className="h-9 rounded-lg px-2.5 text-[#46614d] hover:bg-[#edf4e8]"><Paperclip className="mr-1.5 h-4 w-4" />Add file</Button><span className="hidden text-[11px] text-[#859087] sm:block">Image, PDF, XLSX or pasted text</span><Button onClick={runParse} disabled={parse.isPending || (!sourceText.trim() && !attachment)} size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-[#124e37] text-white hover:bg-[#0e402e] disabled:bg-[#aeb8ae]">{parse.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}<span className="sr-only">Parse order</span></Button></div>
        </div>
        <div className="mt-4 rounded-2xl border border-[#e1e8dc] bg-[#f8faf5] p-3.5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#35543c]">Teach parser permanently</p><p className="mt-0.5 text-[11px] text-[#748176]">Saved rules survive page reloads and future sessions.</p></div><div className="flex min-w-0 flex-1 gap-2"><input value={newMemory} onChange={event => setNewMemory(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && newMemory.trim().length >= 8) saveMemory.mutate({ instruction: newMemory.trim() }); }} placeholder="e.g. Customer X wants Top Cow yellow" className="h-9 min-w-0 flex-1 rounded-lg border border-[#d9e1d5] bg-white px-3 text-xs outline-none transition placeholder:text-[#9ba69b] focus:border-[#78a266] focus:ring-2 focus:ring-[#dcebd0]" /><Button type="button" size="sm" disabled={saveMemory.isPending || newMemory.trim().length < 8} onClick={() => saveMemory.mutate({ instruction: newMemory.trim() })} className="h-9 rounded-lg bg-[#24593a] px-3 text-xs hover:bg-[#1b482e]">Save</Button></div></div>{memories.data && memories.data.length > 0 && <p className="mt-2.5 truncate text-[11px] text-[#607663]">{memories.data.length} saved rule{memories.data.length === 1 ? "" : "s"} active · latest: {memories.data[0]?.instruction}</p>}</div>
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
