import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Download, FileSpreadsheet, Loader2, Paperclip, Plus, ShieldCheck, X } from "lucide-react";
import React, { useRef, useState } from "react";
import { toast } from "sonner";

type AttachmentMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | "application/vnd.ms-excel";
type BranchAttachment = { filename: string; mimeType: AttachmentMime; dataUrl: string };
type BranchDraft = { branchName: string; sourceText: string; attachment: BranchAttachment | null };

const initialBranches: BranchDraft[] = [
  { branchName: "Branch 1", sourceText: "", attachment: null },
  { branchName: "Branch 2", sourceText: "", attachment: null },
  { branchName: "Branch 3", sourceText: "", attachment: null },
];

export default function StockSheet() {
  const [branches, setBranches] = useState<BranchDraft[]>(initialBranches);
  const [generated, setGenerated] = useState<{ downloadUrl: string; summaries: Array<{ branchName: string; totalPkts: number; matchedProductCount: number; unmatchedFgCodes: string[]; warnings: string[] }> } | null>(null);
  const generate = trpc.stock.generate.useMutation({
    onSuccess: (result) => { setGenerated(result); toast.success("Three-branch stock sheet is ready."); },
    onError: error => toast.error(error.message || "The stock sheet could not be generated."),
  });
  const updateBranch = (index: number, patch: Partial<BranchDraft>) => setBranches(current => current.map((branch, branchIndex) => branchIndex === index ? { ...branch, ...patch } : branch));
  const ready = branches.every(branch => branch.branchName.trim().length >= 2 && (branch.sourceText.trim() || branch.attachment));

  return <div className="mx-auto max-w-[1480px] text-[#1d2b22]">
    <header className="mb-8 flex flex-col gap-5 border-b border-[#e5e4dc] pb-7 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#9ac55c]" /><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#607266]">Branch dispatch workspace</span></div><h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-[38px]">Build a stock sheet, <span className="text-[#467752]">branch by branch.</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#687067]">Paste or upload one order for each branch. Cheese Desk maps SAP quantities into your supplied stock-sheet format.</p></div><div className="flex items-center gap-3 rounded-2xl border border-[#e3e3dc] bg-white px-4 py-3 shadow-sm"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf4d9] text-[#467752]"><FileSpreadsheet className="h-4 w-4" /></div><div><p className="text-xs font-semibold">Your Excel format</p><p className="mt-0.5 text-[11px] text-[#758077]">OrderSheet columns are preserved</p></div></div></header>
    <div className="grid gap-5 xl:grid-cols-3">{branches.map((branch, index) => <BranchCard key={index} index={index} branch={branch} busy={generate.isPending} onChange={updateBranch} />)}</div>
    <div className="mt-7 flex flex-col gap-4 rounded-[24px] border border-[#dfe8d9] bg-[#f7fbf3] p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[#4d8452]" /><div><p className="text-sm font-semibold">One completed workbook for all three branches</p><p className="mt-1 text-xs leading-5 text-[#6d7d6d]">Each branch is written to its own OrderSheet row. Unmatched SAP codes are reported before download.</p></div></div><Button disabled={!ready || generate.isPending} onClick={() => generate.mutate({ branches: branches.map(branch => ({ branchName: branch.branchName.trim(), sourceText: branch.sourceText, ...(branch.attachment ? { attachment: branch.attachment } : {}) })) })} className="h-11 rounded-xl bg-[#124e37] px-5 hover:bg-[#0e402e]">{generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}{generate.isPending ? "Building stock sheet…" : "Generate stock sheet"}</Button></div>
    {generated && <section className="mt-7 rounded-[26px] border border-[#e4e4dd] bg-white p-5 shadow-[0_14px_45px_-32px_rgba(26,49,32,0.26)] sm:p-7"><div className="flex flex-col gap-4 border-b border-[#e8ebe4] pb-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#6c7b6e]">Generated workbook</p><h2 className="mt-2 text-xl font-semibold tracking-tight">Three-branch stock sheet is ready</h2></div><a href={generated.downloadUrl}><Button className="h-10 rounded-xl bg-[#124e37] hover:bg-[#0e402e]"><Download className="mr-2 h-4 w-4" />Download Excel</Button></a></div><div className="mt-5 grid gap-4 md:grid-cols-3">{generated.summaries.map(summary => <Card key={summary.branchName} className="rounded-2xl border-[#dfe5da] shadow-none"><CardContent className="p-4"><p className="text-sm font-semibold">{summary.branchName}</p><p className="mt-1 text-xs text-[#6f7c70]">{summary.totalPkts} physical PKT · {summary.matchedProductCount} matched product{summary.matchedProductCount === 1 ? "" : "s"}</p>{summary.unmatchedFgCodes.length > 0 && <p className="mt-3 text-xs leading-5 text-[#9a632c]">Not in template: {summary.unmatchedFgCodes.join(", ")}</p>}{summary.warnings.slice(0, 2).map(warning => <p key={warning} className="mt-2 text-xs leading-5 text-[#9a632c]">{warning}</p>)}</CardContent></Card>)}</div></section>}
  </div>;
}

function BranchCard({ index, branch, busy, onChange }: { index: number; branch: BranchDraft; busy: boolean; onChange: (index: number, patch: Partial<BranchDraft>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const selectFile = (file?: File) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const fallback = ext === "pdf" ? "application/pdf" : ext === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : ext === "xls" ? "application/vnd.ms-excel" : undefined;
    const mimeType = (file.type || fallback) as AttachmentMime | undefined;
    if (!mimeType || !["image/jpeg", "image/png", "image/webp", "application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"].includes(mimeType)) { toast.error("Use an image, PDF, XLSX, or XLS order file."); return; }
    if (file.size > 9_000_000) { toast.error("Use a file smaller than 9 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => onChange(index, { attachment: { filename: file.name, mimeType, dataUrl: String(reader.result) } });
    reader.readAsDataURL(file);
  };
  return <Card className="rounded-[24px] border-[#e1e5de] bg-white shadow-[0_14px_45px_-34px_rgba(26,49,32,0.28)]"><CardContent className="p-5"><div className="mb-4 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e8f3dd] text-xs font-bold text-[#38633e]">0{index + 1}</span><div><p className="text-sm font-semibold">Branch order</p><p className="mt-0.5 text-[11px] text-[#778277]">Text, screenshot, PDF, XLSX or XLS</p></div></div><Input value={branch.branchName} onChange={event => onChange(index, { branchName: event.target.value })} placeholder="Branch name" className="h-10 rounded-xl border-[#dce3d8]" /><Textarea value={branch.sourceText} onChange={event => onChange(index, { sourceText: event.target.value })} disabled={busy} placeholder="Paste this branch's WhatsApp order here…" className="mt-3 min-h-[180px] rounded-xl border-[#dce3d8] bg-[#fbfcfa] text-[13px] leading-6 focus-visible:ring-[#cde4bd]" /><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.xlsx,.xls" className="hidden" onChange={event => selectFile(event.target.files?.[0])} />{branch.attachment ? <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#d8e8cc] bg-[#f2f8ec] px-3 py-2"><FileSpreadsheet className="h-4 w-4 text-[#4b7d4f]" /><span className="min-w-0 flex-1 truncate text-xs font-medium">{branch.attachment.filename}</span><button type="button" onClick={() => onChange(index, { attachment: null })} className="rounded-md p-1 text-[#617660] hover:bg-white"><X className="h-4 w-4" /></button></div> : <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} className="mt-3 h-9 rounded-lg px-2 text-[#46614d] hover:bg-[#edf4e8]"><Paperclip className="mr-1.5 h-4 w-4" />Add branch file</Button>}</CardContent></Card>;
}
