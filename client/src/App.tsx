import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import StockSheet from "./pages/StockSheet";

function WorkspaceRoute({ children }: { children: React.ReactNode }) { return <DashboardLayout>{children}</DashboardLayout>; }

function Router() {
  return <Switch>
    <Route path="/"><WorkspaceRoute><Home /></WorkspaceRoute></Route>
    <Route path="/stock-sheet"><WorkspaceRoute><StockSheet /></WorkspaceRoute></Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
