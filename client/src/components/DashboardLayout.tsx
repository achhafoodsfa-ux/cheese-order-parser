import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { ClipboardPenLine, FileSpreadsheet, LogOut, PanelLeft, Sparkles } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: ClipboardPenLine, label: "New parse", path: "/" },
  { icon: FileSpreadsheet, label: "Stock sheet", path: "/stock-sheet" },
];

const SIDEBAR_WIDTH_KEY = "cheese-parser-sidebar-width";
const DEFAULT_WIDTH = 264;
const MIN_WIDTH = 224;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || DEFAULT_WIDTH);
  const { loading, user } = useAuth();

  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)), [sidebarWidth]);
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <SignInScreen />;

  return <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}><DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent></SidebarProvider>;
}

function SignInScreen() {
  return <div className="min-h-screen bg-[#f7f7f4] flex items-center justify-center p-6">
    <div className="w-full max-w-md rounded-[28px] border border-[#e6e5df] bg-white p-9 shadow-[0_20px_60px_-28px_rgba(23,32,22,0.24)] text-center">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#124e37] text-white"><ClipboardPenLine className="h-6 w-6" /></div>
      <h1 className="text-2xl font-semibold tracking-tight text-[#1d2b22]">Cheese Order Parser</h1>
      <p className="mt-3 text-sm leading-6 text-[#687067]">Sign in to securely parse, save, and revisit customer-specific SAP orders.</p>
      <Button onClick={() => startLogin()} className="mt-7 h-11 w-full rounded-xl bg-[#124e37] hover:bg-[#0e402e]">Sign in to workspace</Button>
    </div>
  </div>;
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const collapsed = state === "collapsed";

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const next = event.clientX - left;
      if (next >= MIN_WIDTH && next <= MAX_WIDTH) setSidebarWidth(next);
    };
    const up = () => setIsResizing(false);
    if (isResizing) { document.addEventListener("mousemove", move); document.addEventListener("mouseup", up); document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }
    return () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); document.body.style.cursor = ""; document.body.style.userSelect = ""; };
  }, [isResizing, setSidebarWidth]);

  return <>
    <div className="relative" ref={sidebarRef}>
      <Sidebar collapsible="icon" className="border-0 bg-[#113c2d] text-white" disableTransition={isResizing}>
        <SidebarHeader className="h-[86px] justify-center px-3">
          <div className="flex w-full items-center gap-3">
            <button onClick={toggleSidebar} aria-label="Toggle navigation" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8 text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6e685]"><PanelLeft className="h-4 w-4" /></button>
            {!collapsed && <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b7d3bd]">Operations</p><p className="mt-1 truncate text-[15px] font-semibold tracking-tight">Cheese Desk</p></div>}
          </div>
        </SidebarHeader>
        <SidebarContent className="px-3 pt-5">
          {!collapsed && <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#89ad94]">Workspace</p>}
          <SidebarMenu className="gap-1">
            {menuItems.map(item => <SidebarMenuItem key={item.path}>
              <SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-11 rounded-xl text-[#dce9df] hover:bg-white/10 hover:text-white data-[active=true]:bg-[#c6e685] data-[active=true]:text-[#163d2d] data-[active=true]:shadow-sm">
                <item.icon className="h-[18px] w-[18px]" /><span className="font-medium">{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>)}
          </SidebarMenu>
          {!collapsed && <div className="mx-1 mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-4"><div className="flex items-center gap-2 text-[#c6e685]"><Sparkles className="h-4 w-4" /><span className="text-xs font-semibold">Parser standard</span></div><p className="mt-2 text-xs leading-5 text-[#bad1c0]">Separate customer blocks. Exact SAP rows. No mixed orders.</p></div>}
        </SidebarContent>
        <SidebarFooter className="p-3">
          <DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6e685] group-data-[collapsible=icon]:justify-center"><Avatar className="h-9 w-9 border border-white/15 bg-[#275b45]"><AvatarFallback className="bg-[#275b45] text-xs font-bold text-[#e5f1e5]">{user?.name?.slice(0, 1).toUpperCase() || "U"}</AvatarFallback></Avatar><div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-medium text-white">{user?.name || "User"}</p><p className="mt-0.5 truncate text-xs text-[#a8c3ae]">Secure workspace</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      {!collapsed && <div className="absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition hover:bg-[#c6e685]/60" onMouseDown={() => setIsResizing(true)} />}
    </div>
    <SidebarInset className="min-h-screen bg-[#f7f7f4]">
      {isMobile && <div className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-[#e5e5df] bg-[#f7f7f4]/95 px-4 backdrop-blur"><SidebarTrigger className="rounded-xl border border-[#dfdfd9] bg-white" /><span className="font-semibold text-[#1d2b22]">Cheese Desk</span></div>}
      <main className="min-h-screen p-4 sm:p-7 lg:p-9">{children}</main>
    </SidebarInset>
  </>;
}
