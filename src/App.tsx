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
import ImageToPDF from "./pages/tools/ImageToPDF";
import PowerPointToPDF from "./pages/tools/PowerPointToPDF";
import PDFToImages from "./pages/tools/PDFToImages";
import PDFToWord from "./pages/tools/PDFToWord";
import PDFToPowerPoint from "./pages/tools/PDFToPowerPoint";
import PDFToExcel from "./pages/tools/PDFToExcel";
import PDFToCSV from "./pages/tools/PDFToCSV";
import PDFToText from "./pages/tools/PDFToText";
import PDFToHTML from "./pages/tools/PDFToHTML";
import PDFToEPUB from "./pages/tools/PDFToEPUB";
import PDFToSVG from "./pages/tools/PDFToSVG";
import PDFOCR from "./pages/tools/PDFOCR";
import MergePDFs from "./pages/tools/MergePDFs";
import SplitPDF from "./pages/tools/SplitPDF";
import WordToPDF from "./pages/tools/WordToPDF";
import ExcelToPDF from "./pages/tools/ExcelToPDF";

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
          <Route path="/tools/images-to-pdf" element={<ImageToPDF />} />
          <Route path="/tools/powerpoint-to-pdf" element={<PowerPointToPDF />} />
          <Route path="/tools/pdf-to-images" element={<PDFToImages />} />
          <Route path="/tools/pdf-to-word" element={<PDFToWord />} />
          <Route path="/tools/pdf-to-powerpoint" element={<PDFToPowerPoint />} />
          <Route path="/tools/pdf-to-excel" element={<PDFToExcel />} />
          <Route path="/tools/pdf-to-csv" element={<PDFToCSV />} />
          <Route path="/tools/pdf-to-text" element={<PDFToText />} />
          <Route path="/tools/pdf-to-html" element={<PDFToHTML />} />
          <Route path="/tools/pdf-to-epub" element={<PDFToEPUB />} />
          <Route path="/tools/pdf-to-svg" element={<PDFToSVG />} />
          <Route path="/tools/pdf-ocr" element={<PDFOCR />} />
          <Route path="/tools/merge-pdfs" element={<MergePDFs />} />
          <Route path="/tools/split-pdf" element={<SplitPDF />} />
          <Route path="/tools/word-to-pdf" element={<WordToPDF />} />
          <Route path="/tools/excel-to-pdf" element={<ExcelToPDF />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
