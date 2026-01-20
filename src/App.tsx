import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import MarginMarkupCalculator from "./pages/tools/MarginMarkupCalculator";
import MeetingCostCalculator from "./pages/tools/MeetingCostCalculator";
import VATCalculator from "./pages/tools/VATCalculator";
import EmailSignatureGenerator from "./pages/tools/EmailSignatureGenerator";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/tools/margin-vs-markup-calculator" element={<MarginMarkupCalculator />} />
          <Route path="/tools/meeting-cost-calculator" element={<MeetingCostCalculator />} />
          <Route path="/tools/vat-calculator" element={<VATCalculator />} />
          <Route path="/tools/email-signature-generator" element={<EmailSignatureGenerator />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
