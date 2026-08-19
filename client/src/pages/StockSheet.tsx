import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Download, FileSpreadsheet, FileText, Loader2, Paperclip, Send, ShieldCheck, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type AttachmentMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | "application/vnd.ms-excel";
type SmartAttachment = { filename: string; mimeType: AttachmentMime; dataUrl: string; kind: "image" | "pdf" | "xlsx" };

export default function StockSheet() {
  const [sourceText, setSourceText] = useState("");
  const [attachment, setAttachment] = useState<SmartAttachment | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [generated, setGenerated] = useState<{ downloadDataUrl: string; summaries: Array<{ branchName: string; totalPkts: number; matchedProductCount: number; unmatchedFgCodes: string[]; warnings: string[] }> } | null>(null);
  const generate = trpc.stock.generateUnified.useMutation({
    onSuccess: result => { setProgress(100); setGenerated(result); setSourceText(""); setAttachment(null); toast.success("Final three-branch stock sheet is ready."); window.setTimeout(() => setProgress(0), 700); },
    onError: error => toast.error(error.message || "The stock sheet could not be generated."),
  });

  useEffect(() => {
    if (!generate.isPending) return;
    setProgress(12);
    const checkpoints = [31, 54, 76, 89];
    let index = 0;
    const timer = window.setInterval(() => setProgress(current => Math.max(current, checkpoints[index++] ?? 89)), 900);
    return () => window.clearInterval(timer);
  }, [generate.isPending]);

  const selectAttachment = (file?: File) => {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    const fallbackMime = extension === "pdf" ? "application/pdf" : extension === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : extension === "xls" ? "application/vnd.ms-excel" : undefined;
    const mimeType = (file.type || fallbackMime) as AttachmentMime | undefined;
    const allowed: AttachmentMime[] = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"];
    if (!mimeType || !allowed.includes(mimeType)) { toast.error("Use an image, PDF, XLSX, or XLS file with all three branch orders."); return; }
    if (file.size > 9_000_000) { toast.error("Use a file smaller than 9 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setAttachment({ filename: file.name, mimeType, dataUrl: String(reader.result), kind: mimeType.startsWith("image/") ? "image" : mimeType === "application/pdf" ? "pdf" : "xlsx" });
    reader.readAsDataURL(file);
  };
  const runGenerate = () => { if (!generate.isPending && (sourceText.trim() || attachment)) generate.mutate({ sourceText, ...(attachment ? { attachment: { filename: attachment.filename, mimeType: attachment.mimeType, dataUrl: attachment.dataUrl } } : {}) }); };
  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); if (!event.dataTransfer.types.includes("Files") && event.dataTransfer.files.length === 0) return; dragDepth.current += 1; setIsDragActive(true); };
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setIsDragActive(false); } };
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); dragDepth.current = 0; setIsDragActive(false); selectAttachment(event.dataTransfer.files?.[0]); };

  return <div className="mx-auto max-w-[1480px] text-[#1d2b22]">
    <header className="mb-8 flex flex-col gap-5 border-b border-[#e5e4dc] pb-7 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#9ac55c]" /><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#607266]">Branch dispatch workspace</span></div><h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-[38px]">One input, <span className="text-[#467752]">one finished stock sheet.</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#687067]">Drop one WhatsApp screenshot, paste all three branch orders, or upload a PDF/Excel file. Cheese Desk finds each branch automatically and fills your stock sheet.</p></div><div className="flex items-center gap-3 rounded-2xl border border-[#e3e3dc] bg-white px-4 py-3 shadow-sm"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf4d9] text-[#467752]"><FileSpreadsheet className="h-4 w-4" /></div><div><p className="text-xs font-semibold">Your Excel format</p><p className="mt-0.5 text-[11px] text-[#758077]">Three branches detected automatically</p></div></div></header>
    <section onDragEnter={handleDragEnter} onDragOver={event => event.preventDefault()} onDragLeave={handleDragLeave} onDrop={handleDrop} className="rounded-[28px] border border-[#e4e4dd] bg-white p-5 shadow-[0_16px_48px_-34px_rgba(26,49,32,0.3)] sm:p-7"><div className={`relative rounded-[22px] border bg-[#fafbf8] p-2 shadow-inner transition focus-within:ring-4 focus-within:ring-[#dcebd0] ${isDragActive ? "border-[#6d9d5d] ring-4 ring-[#dcebd0]" : "border-[#d9ded5] focus-within:border-[#79a568]"}`}>
      {isDragActive && <div className="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center rounded-[17px] border-2 border-dashed border-[#6c995b] bg-[#eff8e7]/95 text-center shadow-sm"><Paperclip className="h-6 w-6 text-[#416c47]" /><p className="mt-2 text-sm font-semibold text-[#31583a]">Drop the three-branch order file here</p><p className="mt-1 text-xs text-[#627c66]">Image, PDF, XLSX or XLS</p></div>}
      {generate.isPending && <div className="absolute inset-2 z-30 flex flex-col items-center justify-center rounded-[17px] bg-[#f7fbf2]/95 px-8 text-center backdrop-blur-sm"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e4f0d8] text-[#356b42]"><Loader2 className="h-5 w-5 animate-spin" /></div><p className="mt-4 text-sm font-semibold text-[#264b31]">Building your final stock sheet…</p><p className="mt-1 text-xs text-[#6b7c6d]">Reading orders, identifying 3 branches, matching SAP codes</p><Progress value={progress} className="mt-5 h-2 w-full max-w-sm bg-[#dfe9d9]" /></div>}
      <Textarea value={sourceText} onChange={event => setSourceText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); runGenerate(); } }} onPaste={event => { const file = event.clipboardData.files[0]; if (file) { event.preventDefault(); selectAttachment(file); } }} placeholder={'Paste all 3 branch WhatsApp orders here, or paste one screenshot.\n\nPress Enter to generate · Shift+Enter for a new line\n\nExample:\nGR\n2 ctn imp 70/30\n\nImtiaz Butt\n2 ctn Achha Mozzarella shred\n\nShah Noor\n6 ctn local 70/30'} className="min-h-[290px] resize-y border-0 bg-transparent p-4 font-mono text-[13px] leading-6 text-[#2b392e] placeholder:text-[#a2a9a1] focus-visible:ring-0" />
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.xlsx,.xls" className="hidden" onChange={event => selectAttachment(event.target.files?.[0])} />
      {attachment && <div className="mx-2 mb-2 flex items-center gap-3 rounded-xl border border-[#d5e5c9] bg-[#f3f8ed] p-2.5">{attachment.kind === "image" ? <img src={attachment.dataUrl} alt="Selected stock-order attachment" className="h-10 w-10 rounded-lg object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#467752]">{attachment.kind === "pdf" ? <FileText className="h-5 w-5" /> : <FileSpreadsheet className="h-5 w-5" />}</div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{attachment.filename}</p><p className="mt-0.5 text-[11px] text-[#667867]">All branch orders will be read from this file</p></div><Button size="icon" variant="ghost" onClick={() => setAttachment(null)} className="h-8 w-8 rounded-lg text-[#6d776e] hover:bg-white hover:text-[#254f38]"><X className="h-4 w-4" /></Button></div>}
      <div className="flex items-center justify-between gap-3 border-t border-[#e4e8e0] px-2 pt-2"><Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()} className="h-9 rounded-lg px-2.5 text-[#46614d] hover:bg-[#edf4e8]"><Paperclip className="mr-1.5 h-4 w-4" />Add file</Button><span className="hidden text-[11px] text-[#859087] sm:block">One input · 3 branch orders · final Excel</span><Button onClick={runGenerate} disabled={generate.isPending || (!sourceText.trim() && !attachment)} className="h-10 rounded-xl bg-[#124e37] px-4 text-white hover:bg-[#0e402e] disabled:bg-[#aeb8ae]">{generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Generate sheet</Button></div>
    </div></section>
    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#e1e8dc] bg-[#f8faf5] p-4"><ShieldCheck className="mt-0.5 h-5 w-5 text-[#4d8452]" /><p className="text-xs leading-5 text-[#667766]">The smart box must contain exactly three branch/customer orders. Each detected branch is written to its own row in your supplied OrderSheet template. Any unmatched SAP code is shown before download.</p></div>
    {generated && <section className="mt-7 rounded-[26px] border border-[#e4e4dd] bg-white p-5 shadow-[0_14px_45px_-32px_rgba(26,49,32,0.26)] sm:p-7"><div className="flex flex-col gap-4 border-b border-[#e8ebe4] pb-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#6c7b6e]">Generated workbook</p><h2 className="mt-2 text-xl font-semibold tracking-tight">Final stock sheet is ready</h2><p className="mt-1 text-xs text-[#6f7c70]">Ready to download for this session; it is not added to order history.</p></div><a href={generated.downloadDataUrl} download="cheese-stock-sheet.xlsx"><Button className="h-10 rounded-xl bg-[#124e37] hover:bg-[#0e402e]"><Download className="mr-2 h-4 w-4" />Download Excel</Button></a></div><div className="mt-5 grid gap-4 md:grid-cols-3">{generated.summaries.map(summary => <Card key={summary.branchName} className="rounded-2xl border-[#dfe5da] shadow-none"><CardContent className="p-4"><p className="text-sm font-semibold">{summary.branchName}</p><p className="mt-1 text-xs text-[#6f7c70]">{summary.totalPkts} physical PKT · {summary.matchedProductCount} matched product{summary.matchedProductCount === 1 ? "" : "s"}</p>{summary.unmatchedFgCodes.length > 0 && <p className="mt-3 text-xs leading-5 text-[#9a632c]">Not in template: {summary.unmatchedFgCodes.join(", ")}</p>}{summary.warnings.slice(0, 2).map(warning => <p key={warning} className="mt-2 text-xs leading-5 text-[#9a632c]">{warning}</p>)}</CardContent></Card>)}</div></section>}
  </div>;
}
