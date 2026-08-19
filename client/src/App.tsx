import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import HistoryPage from "./pages/History";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

function WorkspaceRoute({ children }: { children: React.ReactNode }) { return <DashboardLayout>{children}</DashboardLayout>; }

function Router() {
  return <Switch>
    <Route path="/"><WorkspaceRoute><Home /></WorkspaceRoute></Route>
    <Route path="/history"><WorkspaceRoute><HistoryPage /></WorkspaceRoute></Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
