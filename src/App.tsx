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
import InvoiceGenerator from "./pages/tools/InvoiceGenerator";
import BreakEvenCalculator from "./pages/tools/BreakEvenCalculator";
import ROICalculator from "./pages/tools/ROICalculator";
import PricingCalculator from "./pages/tools/PricingCalculator";
import CashFlowForecast from "./pages/tools/CashFlowForecast";
import HeadcountCostCalculator from "./pages/tools/HeadcountCostCalculator";

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
          <Route path="/tools/invoice-generator" element={<InvoiceGenerator />} />
          <Route path="/tools/break-even-calculator" element={<BreakEvenCalculator />} />
          <Route path="/tools/roi-calculator" element={<ROICalculator />} />
          <Route path="/tools/pricing-calculator" element={<PricingCalculator />} />
          <Route path="/tools/cash-flow-forecast" element={<CashFlowForecast />} />
          <Route path="/tools/headcount-cost-calculator" element={<HeadcountCostCalculator />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
