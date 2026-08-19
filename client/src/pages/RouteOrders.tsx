import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copyImageToClipboard, createRouteMatrixImage, routeMatrixImageFileName } from "@/lib/routeMatrixImage";
import { buildRouteMatrix, buildRouteReportFromRows, filterRouteCustomers, formatUnits, type RouteReport } from "@/lib/routeReport";
import { Building2, Clipboard, Download, FileSpreadsheet, Filter, Loader2, MapPinned, Paperclip, Route, ShieldCheck, Upload, UsersRound, X } from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const compactProductName = (name: string) => name
  .replace(/Mozzarella/gi, "Mozz")
  .replace(/Cheddar/gi, "Chedd")
  .replace(/Shredded/gi, "Shred")
  .replace(/Imported\/Uk/gi, "Imp")
  .replace(/Pizza Toping/gi, "Pizza")
  .replace(/\s+/g, " ")
  .trim();

export default function RouteOrders() {
  const [report, setReport] = useState<RouteReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [route, setRoute] = useState("");
  const [category, setCategory] = useState("all");
  const [isReading, setIsReading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const receiveFile = async (file?: File) => {
    if (!file || isReading) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(extension ?? "")) { toast.error("Please upload an Excel XLSX or XLS day-end sales report."); return; }
    if (file.size > 14_000_000) { toast.error("Please use an Excel file smaller than 14 MB."); return; }
    try {
      setIsReading(true);
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellText: true, cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
      if (!firstSheet) throw new Error("No readable worksheet was found in this file.");
      const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: "", raw: false });
      const nextReport = buildRouteReportFromRows(rows);
      if (nextReport.customers.length === 0) throw new Error("No customer products with positive quantities were found in this sheet.");
      setReport(nextReport); setFileName(file.name); setRoute(nextReport.routes[0] ?? ""); setCategory("all");
      toast.success(`${nextReport.customers.length} customers across ${nextReport.routes.length} routes are ready. Select one route to view its matrix.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "This day-end report could not be read."); }
    finally { setIsReading(false); }
  };

  const customers = useMemo(() => report && route ? filterRouteCustomers(report, route, category) : [], [report, route, category]);
  const matrix = useMemo(() => buildRouteMatrix(customers), [customers]);
  const isDenseMatrix = matrix.customers.length >= 30;
  const customerColumnWidth = isDenseMatrix ? "154px" : "20%";
  const unitsColumnWidth = isDenseMatrix ? "44px" : "6%";
  const productWidth = isDenseMatrix ? "58px" : matrix.products.length > 0 ? `${74 / matrix.products.length}%` : "74%";
  const selectedLabel = [route, category !== "all" ? category.replace(/^CFS\s*-\s*/i, "") : "All categories"].filter(Boolean).join(" · ");
  const clearReport = () => { setReport(null); setFileName(""); setRoute(""); setCategory("all"); if (inputRef.current) inputRef.current.value = ""; };
  const copyMatrix = async () => {
    if (!route || matrix.customers.length === 0 || isCopying) return;
    try {
      setIsCopying(true);
      const blob = await createRouteMatrixImage({ route, category, matrix });
      const filename = routeMatrixImageFileName(route, category);
      const copied = await copyImageToClipboard(blob);
      if (copied) {
        toast.success("Route matrix copied as an image. Paste it anywhere you need.");
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = filename; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 500);
        toast.success("Your browser cannot copy images, so the PNG was downloaded instead.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The route image could not be copied.");
    } finally { setIsCopying(false); }
  };

  return <div className="mx-auto max-w-[1480px] text-[#1d2b22]">
    <header className="mb-8 flex flex-col gap-5 border-b border-[#e5e4dc] pb-7 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#9ac55c]" /><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#607266]">Day-end sales review</span></div><h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-[38px]">Route-wise <span className="text-[#467752]">customer matrix.</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#687067]">Select one route for one compact matrix: customers in rows, ordered products in columns, and every quantity visible together for a single screenshot.</p></div><div className="flex items-center gap-3 rounded-2xl border border-[#e3e3dc] bg-white px-4 py-3 shadow-sm"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf4d9] text-[#467752]"><MapPinned className="h-4 w-4" /></div><div><p className="text-xs font-semibold">One route · one matrix</p><p className="mt-0.5 text-[11px] text-[#758077]">All customers & products together</p></div></div></header>

    <section onDragEnter={event => { event.preventDefault(); if (event.dataTransfer.files.length) { dragDepth.current += 1; setIsDragActive(true); } }} onDragOver={event => event.preventDefault()} onDragLeave={event => { event.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setIsDragActive(false); } }} onDrop={event => { event.preventDefault(); dragDepth.current = 0; setIsDragActive(false); void receiveFile(event.dataTransfer.files[0]); }} className={`rounded-[26px] border bg-white p-5 shadow-[0_14px_45px_-32px_rgba(26,49,32,0.3)] transition sm:p-7 ${isDragActive ? "border-[#6e9c5d] ring-4 ring-[#deedcf]" : "border-[#e4e4dd]"}`}>
      {!report ? <div className="flex min-h-52 flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-[#d7e2d0] bg-[#fafcf8] px-6 py-8 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf4df] text-[#356b42]"><FileSpreadsheet className="h-6 w-6" /></div><h2 className="mt-4 text-lg font-semibold">Upload day-end sales sheet</h2><p className="mt-1 max-w-md text-sm leading-6 text-[#718073]">Use the report that contains <b>Route</b>, <b>Cst Name</b>, <b>Cst Group</b>, and FG product columns. The file is read in your browser and is not saved.</p><input ref={inputRef} type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={event => void receiveFile(event.target.files?.[0])} /><Button type="button" onClick={() => inputRef.current?.click()} disabled={isReading} className="mt-5 h-10 rounded-xl bg-[#124e37] px-4 hover:bg-[#0e402e]">{isReading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{isReading ? "Reading report…" : "Choose Excel file"}</Button><p className="mt-3 text-[11px] text-[#829083]">You can also drag and drop the file here.</p></div> : <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eaf4df] text-[#356b42]"><FileSpreadsheet className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold">{fileName}</p><p className="mt-0.5 text-xs text-[#6c7b6e]">{report.sourceRows} order rows · {report.customers.length} customers · {report.routes.length} routes</p></div></div><div className="flex gap-2"><Button variant="outline" onClick={() => inputRef.current?.click()} className="h-9 rounded-lg border-[#cfddc9] bg-white text-xs text-[#325a3c] hover:bg-[#f3f8ee]"><Paperclip className="mr-1.5 h-3.5 w-3.5" />Change file</Button><Button variant="ghost" size="icon" onClick={clearReport} className="h-9 w-9 rounded-lg text-[#738075] hover:bg-[#f8f1ed] hover:text-[#9b482f]"><X className="h-4 w-4" /><span className="sr-only">Clear report</span></Button></div><input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={event => void receiveFile(event.target.files?.[0])} /></div>}
    </section>

    {report && <><section className="mt-5 rounded-[22px] border border-[#dfe7da] bg-[#f8faf5] p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-[#46694c]"><Filter className="h-4 w-4" /><p className="text-xs font-bold uppercase tracking-[0.15em]">Matrix filters</p></div><p className="mt-2 text-sm text-[#637364]">Only products ordered by the selected route appear as columns, so its full report remains compact.</p></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#617361]">Selected route<Select value={route} onValueChange={setRoute}><SelectTrigger className="h-10 min-w-[200px] border-[#d5e0d0] bg-white text-left font-medium normal-case tracking-normal text-[#263a2a]"><Route className="mr-2 h-4 w-4 text-[#52755a]" /><SelectValue placeholder="Select a route" /></SelectTrigger><SelectContent>{report.routes.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label><label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#617361]">Customer category<Select value={category} onValueChange={setCategory}><SelectTrigger className="h-10 min-w-[200px] border-[#d5e0d0] bg-white text-left font-medium normal-case tracking-normal text-[#263a2a]"><Building2 className="mr-2 h-4 w-4 text-[#52755a]" /><SelectValue placeholder="All categories" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{report.categories.map(item => <SelectItem key={item} value={item}>{item.replace(/^CFS\s*-\s*/i, "")}</SelectItem>)}</SelectContent></Select></label></div></div></section>
      <section aria-label="Selected route compact matrix" className="mt-6 overflow-hidden rounded-[28px] border border-[#dce5d8] bg-white shadow-[0_16px_48px_-34px_rgba(26,49,32,0.32)]"><div className="bg-[#174c37] px-5 py-5 text-white sm:px-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/12"><MapPinned className="h-5 w-5" /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#bdd6c3]">Selected route · compact confirmation matrix</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{selectedLabel}</h2></div></div><div className="flex flex-wrap gap-2"><span className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-[#ecf9e5]"><UsersRound className="h-4 w-4" />{matrix.customers.length} customer{matrix.customers.length === 1 ? "" : "s"}</span><span className="rounded-xl bg-[#dff0d4] px-3 py-2 text-xs font-bold text-[#24583a]">{formatUnits(matrix.totalUnits)} total units</span></div></div></div><div className="flex flex-col gap-3 border-b border-[#e5ebe1] bg-[#f6f9f3] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7"><p className="text-xs text-[#667766]">Customers are rows. Only products ordered in this route are shown as columns.</p><div className="flex items-center gap-2"><div className="hidden items-center gap-2 text-xs font-semibold text-[#3f6d45] sm:flex"><ShieldCheck className="h-4 w-4" />Ready to copy & paste</div><Button onClick={() => void copyMatrix()} disabled={isCopying || matrix.customers.length === 0} className="h-9 rounded-lg bg-[#174c37] px-3 text-xs font-semibold hover:bg-[#0f3e2c]">{isCopying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Clipboard className="mr-1.5 h-3.5 w-3.5" />}{isCopying ? "Copying image…" : "Copy as image"}</Button></div></div>
        {matrix.customers.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f6eee8] text-[#a75d3f]"><Filter className="h-5 w-5" /></div><h3 className="mt-4 font-semibold">No customer orders match this route and category</h3><p className="mt-1 text-sm text-[#718073]">Choose another category or selected route.</p></div> : <div className="overflow-x-auto"><table className={`${isDenseMatrix ? "w-max min-w-full" : "w-full"} table-fixed border-collapse text-[10px] leading-tight`}><colgroup><col style={{ width: customerColumnWidth }} /><col style={{ width: unitsColumnWidth }} />{matrix.products.map(product => <col key={product.code ?? product.name} style={{ width: productWidth }} />)}</colgroup><thead><tr className="border-b border-[#d9e4d5] bg-[#edf5e8]"><th className={`border-r border-[#d9e4d5] text-left font-bold text-[#2d5137] ${isDenseMatrix ? "px-2 py-4 text-[12px]" : "px-3 py-3 text-[11px]"}`}>Customer</th><th className={`border-r border-[#d9e4d5] text-center font-bold uppercase tracking-[0.08em] text-[#2d5137] ${isDenseMatrix ? "px-0.5 py-4 text-[10px]" : "px-1 py-3 text-[9px]"}`}>Units</th>{matrix.products.map(product => <th key={product.code ?? product.name} title={`${product.code ?? ""} ${product.name}`} className={`border-r border-[#d9e4d5] text-center align-bottom last:border-r-0 ${isDenseMatrix ? "px-0.5 py-4" : "px-1 py-2"}`}><p className={`font-mono font-bold text-[#59725e] ${isDenseMatrix ? "text-[9px]" : "text-[8px]"}`}>{product.code?.replace("FG-", "")}</p><p className={`mt-1 break-words font-bold text-[#294d33] ${isDenseMatrix ? "text-[10px] leading-[0.8rem]" : "text-[9px] leading-3"}`}>{compactProductName(product.name)}</p></th>)}</tr></thead><tbody>{matrix.customers.map((customer, index) => { const quantities = new Map(customer.products.map(product => [product.code ?? product.name, product.quantity])); return <tr key={customer.id} className={index % 2 === 0 ? "bg-white" : "bg-[#fbfdf9]"}><td className={`border-r border-b border-[#e4ebe0] text-left align-middle ${isDenseMatrix ? "px-2 py-1.5" : "px-3 py-2"}`}><p className={`truncate font-semibold text-[#263a2a] ${isDenseMatrix ? "max-w-[138px] text-[10px] leading-3" : "leading-4"}`}>{customer.customerName}</p><p className={`mt-0.5 truncate text-[#718073] ${isDenseMatrix ? "max-w-[138px] text-[7px]" : "text-[8px]"}`}>{customer.customerCode}{customer.category ? ` · ${customer.category.replace(/^CFS\s*-\s*/i, "")}` : ""}</p></td><td className={`border-r border-b border-[#e4ebe0] px-1 text-center font-bold text-[#24583a] ${isDenseMatrix ? "py-1.5 text-[10px]" : "py-2 text-[11px]"}`}>{formatUnits(customer.totalUnits)}</td>{matrix.products.map(product => { const value = quantities.get(product.code ?? product.name) ?? 0; return <td key={product.code ?? product.name} className={`border-r border-b border-[#e4ebe0] px-0.5 text-center last:border-r-0 ${isDenseMatrix ? "py-1.5 text-[10px]" : "px-1 py-2 text-[11px]"} ${value > 0 ? "font-bold text-[#174f36]" : "text-[#b5beb4]"}`}>{value > 0 ? formatUnits(value) : "–"}</td>; })}</tr>; })}</tbody><tfoot><tr className="bg-[#dff0d4]"><td className={`border-r border-[#c5dec0] font-bold uppercase tracking-[0.08em] text-[#24583a] ${isDenseMatrix ? "px-2 py-2 text-[10px]" : "px-3 py-3 text-[11px]"}`}>Route total</td><td className={`border-r border-[#c5dec0] px-1 text-center font-bold text-[#174f36] ${isDenseMatrix ? "py-2 text-[10px]" : "py-3 text-[11px]"}`}>{formatUnits(matrix.totalUnits)}</td>{matrix.products.map(product => <td key={product.code ?? product.name} className={`border-r border-[#c5dec0] px-0.5 text-center font-bold text-[#174f36] last:border-r-0 ${isDenseMatrix ? "py-2 text-[10px]" : "px-1 py-3 text-[11px]"}`}>{formatUnits(product.totalUnits)}</td>)}</tr></tfoot></table></div>}
      </section></>}
  </div>;
}
