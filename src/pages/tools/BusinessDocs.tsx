import { useEffect, useMemo, useRef, useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Receipt,
  FileSignature,
  Shield,
  Presentation,
  Plus,
  Trash2,
  RotateCcw,
  Printer,
  Copy,
  Download,
} from "lucide-react";
import { toast } from "sonner";

type CurrencyCode =
  | "EUR"
  | "USD"
  | "GBP"
  | "CHF"
  | "JPY"
  | "AUD"
  | "CAD"
  | "CNY"
  | "INR"
  | "NZD"
  | "SEK"
  | "NOK"
  | "DKK"
  | "SGD"
  | "HKD";

const currencies: { code: CurrencyCode; symbol: string }[] = [
  { code: "EUR", symbol: "€" },
  { code: "USD", symbol: "$" },
  { code: "GBP", symbol: "£" },
  { code: "CHF", symbol: "CHF " },
  { code: "JPY", symbol: "¥" },
  { code: "AUD", symbol: "$" },
  { code: "CAD", symbol: "$" },
  { code: "CNY", symbol: "¥" },
  { code: "INR", symbol: "₹" },
  { code: "NZD", symbol: "$" },
  { code: "SEK", symbol: "kr" },
  { code: "NOK", symbol: "kr" },
  { code: "DKK", symbol: "kr" },
  { code: "SGD", symbol: "$" },
  { code: "HKD", symbol: "$" },
];

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copied");
}

function formatMoney(amount: number, currency: CurrencyCode) {
  const symbol = currencies.find((c) => c.code === currency)?.symbol ?? "€";
  return `${symbol}${amount.toFixed(2)}`;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

/* -----------------------------
   Print styles – only .print-preview shows on print
------------------------------*/
const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  .print-preview, .print-preview * { visibility: visible !important; }
  .print-preview {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    margin: 0 !important;
    padding: 2rem !important;
    border: none !important;
    border-radius: 0 !important;
    background: white !important;
    color: #1e293b !important;
    box-shadow: none !important;
    overflow: visible !important;
    max-height: none !important;
  }
}
`;

function PrintStyleTag() {
  return <style dangerouslySetInnerHTML={{ __html: PRINT_STYLE }} />;
}

/* -----------------------------
   Mobile-friendly Invoice
------------------------------*/
function InvoiceGeneratorEmbedded() {
  const [sellerName, setSellerName] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");

  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [invoiceNumber, setInvoiceNumber] = useState("INV-001");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");

  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const [vatRate, setVatRate] = useState(20);

  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ id: "1", description: "", quantity: 1, unitPrice: 0 }]);

  const subtotal = useMemo(() => lineItems.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0), [lineItems]);
  const vatAmount = useMemo(() => subtotal * (vatRate / 100), [subtotal, vatRate]);
  const total = useMemo(() => subtotal + vatAmount, [subtotal, vatAmount]);

  const addLine = () => {
    setLineItems((prev) => [...prev, { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeLine = (id: string) => {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.id !== id)));
  };

  const updateLine = (id: string, patch: Partial<LineItem>) => {
    setLineItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const reset = () => {
    setSellerName("");
    setSellerAddress("");
    setSellerEmail("");
    setClientName("");
    setClientAddress("");
    setClientEmail("");
    setInvoiceNumber("INV-001");
    setInvoiceDate(todayISO());
    setDueDate("");
    setCurrency("EUR");
    setVatRate(20);
    setNotes("");
    setLineItems([{ id: "1", description: "", quantity: 1, unitPrice: 0 }]);
    toast.success("Invoice reset");
  };

  const print = () => window.print();

  const invoiceText = useMemo(() => {
    const lines = lineItems
      .map(
        (it) =>
          `- ${it.description || "—"} | Qty ${it.quantity} x ${formatMoney(it.unitPrice, currency)} = ${formatMoney(
            it.quantity * it.unitPrice,
            currency,
          )}`,
      )
      .join("\n");

    return [
      `INVOICE ${invoiceNumber}`,
      ``,
      `From: ${sellerName || "Your Company"}`,
      `${sellerAddress || ""}`.trim(),
      sellerEmail ? `Email: ${sellerEmail}` : "",
      ``,
      `Bill To: ${clientName || "Client Name"}`,
      `${clientAddress || ""}`.trim(),
      clientEmail ? `Email: ${clientEmail}` : "",
      ``,
      `Date: ${invoiceDate}`,
      dueDate ? `Due: ${dueDate}` : "",
      ``,
      `Items:`,
      lines || "- —",
      ``,
      `Subtotal: ${formatMoney(subtotal, currency)}`,
      `VAT (${vatRate}%): ${formatMoney(vatAmount, currency)}`,
      `Total: ${formatMoney(total, currency)}`,
      ``,
      notes ? `Notes:\n${notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, [
    clientAddress,
    clientEmail,
    clientName,
    currency,
    dueDate,
    invoiceDate,
    invoiceNumber,
    lineItems,
    notes,
    sellerAddress,
    sellerEmail,
    sellerName,
    subtotal,
    total,
    vatAmount,
    vatRate,
  ]);

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* INPUTS */}
      <div className="space-y-6 print:hidden">
        {/* Seller */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Your Information</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="inv-sellerName">Company / Name</Label>
              <Input
                id="inv-sellerName"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Your Company Ltd"
              />
            </div>
            <div>
              <Label htmlFor="inv-sellerAddress">Address</Label>
              <Textarea
                id="inv-sellerAddress"
                value={sellerAddress}
                onChange={(e) => setSellerAddress(e.target.value)}
                placeholder={"123 Business Street\nCity, Country"}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="inv-sellerEmail">Email</Label>
              <Input
                id="inv-sellerEmail"
                type="email"
                value={sellerEmail}
                onChange={(e) => setSellerEmail(e.target.value)}
                placeholder="billing@company.com"
              />
            </div>
          </div>
        </div>

        {/* Client */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Client Information</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="inv-clientName">Client Name</Label>
              <Input
                id="inv-clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client Company"
              />
            </div>
            <div>
              <Label htmlFor="inv-clientAddress">Address</Label>
              <Textarea
                id="inv-clientAddress"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder={"456 Client Avenue\nCity, Country"}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="inv-clientEmail">Email</Label>
              <Input
                id="inv-clientEmail"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="contact@client.com"
              />
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Invoice Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="inv-number">Invoice Number</Label>
              <Input id="inv-number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="inv-currency">Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                <SelectTrigger id="inv-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="inv-date">Invoice Date</Label>
              <Input id="inv-date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="inv-due">Due Date</Label>
              <Input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="inv-vat">VAT Rate (%)</Label>
              <Input
                id="inv-vat"
                type="number"
                min={0}
                max={100}
                value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-foreground">Line Items</h3>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-2" /> Add Line
            </Button>
          </div>

          {/* Mobile cards */}
          <div className="space-y-4 sm:hidden">
            {lineItems.map((it, idx) => (
              <div key={it.id} className="rounded-lg border border-border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Item {idx + 1}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(it.id)}
                    disabled={lineItems.length === 1}
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div>
                  <Label>Description</Label>
                  <Input
                    value={it.description}
                    onChange={(e) => updateLine(it.id, { description: e.target.value })}
                    placeholder="Service or product"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => updateLine(it.id, { quantity: Math.max(1, Number(e.target.value || 1)) })}
                    />
                  </div>
                  <div>
                    <Label>Unit Price</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.unitPrice}
                      onChange={(e) => updateLine(it.id, { unitPrice: Math.max(0, Number(e.target.value || 0)) })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="text-sm font-semibold">{formatMoney(it.quantity * it.unitPrice, currency)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop grid */}
          <div className="hidden sm:block space-y-3">
            {lineItems.map((it, index) => (
              <div key={it.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-6 lg:col-span-6">
                  {index === 0 && <Label>Description</Label>}
                  <Input
                    value={it.description}
                    onChange={(e) => updateLine(it.id, { description: e.target.value })}
                    placeholder="Service or product"
                  />
                </div>

                <div className="col-span-2">
                  {index === 0 && <Label>Qty</Label>}
                  <Input
                    type="number"
                    min={1}
                    value={it.quantity}
                    onChange={(e) => updateLine(it.id, { quantity: Math.max(1, Number(e.target.value || 1)) })}
                  />
                </div>

                <div className="col-span-3">
                  {index === 0 && <Label>Unit Price</Label>}
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={it.unitPrice}
                    onChange={(e) => updateLine(it.id, { unitPrice: Math.max(0, Number(e.target.value || 0)) })}
                  />
                </div>

                <div className="col-span-1 flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(it.id)}
                    disabled={lineItems.length === 1}
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <Label htmlFor="inv-notes">Notes / Payment Terms</Label>
          <Textarea
            id="inv-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment due within 30 days..."
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button onClick={print} className="h-11 sm:col-span-1">
            <Printer className="h-4 w-4 mr-2" /> Print / PDF
          </Button>
          <Button variant="outline" className="h-11 sm:col-span-1" onClick={() => copyToClipboard(invoiceText)}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
          <Button
            variant="outline"
            className="h-11 sm:col-span-1"
            onClick={() =>
              downloadBlob(
                `invoice-${invoiceNumber}.txt`,
                new Blob([invoiceText], { type: "text/plain;charset=utf-8" }),
              )
            }
          >
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>

          <Button variant="outline" className="h-11 sm:col-span-3" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset
          </Button>
        </div>
      </div>

      {/* PREVIEW */}
      <div className="print-preview bg-white text-slate-900 rounded-xl border border-border p-6 sm:p-8 max-h-[700px] overflow-y-auto">
        <div className="space-y-6">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-foreground break-words">{sellerName || "Your Company"}</h2>
              <p className="text-muted-foreground whitespace-pre-line text-sm mt-1">
                {sellerAddress || "Your address"}
              </p>
              {sellerEmail && <p className="text-muted-foreground text-sm break-words">{sellerEmail}</p>}
            </div>
            <div className="text-right shrink-0">
              <h1 className="text-3xl font-bold text-primary">INVOICE</h1>
              <p className="text-foreground font-medium mt-2">{invoiceNumber}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-border">
            <div>
              <h3 className="font-semibold text-foreground mb-2">Bill To:</h3>
              <p className="font-medium">{clientName || "Client Name"}</p>
              <p className="text-muted-foreground whitespace-pre-line text-sm">{clientAddress || "Client address"}</p>
              {clientEmail && <p className="text-muted-foreground text-sm break-words">{clientEmail}</p>}
            </div>
            <div className="sm:text-right">
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  <span className="font-medium">{invoiceDate}</span>
                </p>
                {dueDate && (
                  <p>
                    <span className="text-muted-foreground">Due:</span> <span className="font-medium">{dueDate}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 text-sm font-semibold">Description</th>
                  <th className="text-right p-3 text-sm font-semibold w-20">Qty</th>
                  <th className="text-right p-3 text-sm font-semibold w-28">Price</th>
                  <th className="text-right p-3 text-sm font-semibold w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="p-3 text-sm">{it.description || "—"}</td>
                    <td className="p-3 text-sm text-right">{it.quantity}</td>
                    <td className="p-3 text-sm text-right">{formatMoney(it.unitPrice, currency)}</td>
                    <td className="p-3 text-sm text-right font-medium">
                      {formatMoney(it.quantity * it.unitPrice, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMoney(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT ({vatRate}%)</span>
                <span>{formatMoney(vatAmount, currency)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                <span>Total</span>
                <span className="text-primary">{formatMoney(total, currency)}</span>
              </div>
            </div>
          </div>

          {notes && (
            <div className="pt-4 border-t border-border">
              <h3 className="font-semibold text-foreground mb-2">Notes</h3>
              <p className="text-muted-foreground text-sm whitespace-pre-line">{notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   Receipt Generator
------------------------------*/
function ReceiptGeneratorEmbedded() {
  const [merchantName, setMerchantName] = useState("");
  const [merchantAddress, setMerchantAddress] = useState("");
  const [merchantEmail, setMerchantEmail] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("RCP-001");
  const [date, setDate] = useState(todayISO());
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");

  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Card" | "Cash" | "Bank Transfer" | "Other">("Card");
  const [taxRate, setTaxRate] = useState(0);

  const [items, setItems] = useState<LineItem[]>([{ id: "1", description: "", quantity: 1, unitPrice: 0 }]);
  const [footer, setFooter] = useState("Thank you for your purchase!");

  const subtotal = useMemo(() => items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0), [items]);
  const taxAmount = useMemo(() => subtotal * (taxRate / 100), [subtotal, taxRate]);
  const total = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);

  const addItem = () =>
    setItems((p) => [...p, { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0 }]);
  const removeItem = (id: string) => setItems((p) => (p.length <= 1 ? p : p.filter((x) => x.id !== id)));
  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setItems((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const reset = () => {
    setMerchantName("");
    setMerchantAddress("");
    setMerchantEmail("");
    setReceiptNumber("RCP-001");
    setDate(todayISO());
    setCurrency("EUR");
    setCustomerName("");
    setPaymentMethod("Card");
    setTaxRate(0);
    setItems([{ id: "1", description: "", quantity: 1, unitPrice: 0 }]);
    setFooter("Thank you for your purchase!");
    toast.success("Receipt reset");
  };

  const print = () => window.print();

  const receiptText = useMemo(() => {
    const lines = items
      .map(
        (it) =>
          `- ${it.description || "—"} | Qty ${it.quantity} x ${formatMoney(it.unitPrice, currency)} = ${formatMoney(
            it.quantity * it.unitPrice,
            currency,
          )}`,
      )
      .join("\n");

    return [
      `RECEIPT ${receiptNumber}`,
      ``,
      `${merchantName || "Merchant"}`,
      `${merchantAddress || ""}`.trim(),
      merchantEmail ? `Email: ${merchantEmail}` : "",
      ``,
      `Date: ${date}`,
      customerName ? `Customer: ${customerName}` : "",
      `Payment: ${paymentMethod}`,
      ``,
      `Items:`,
      lines || "- —",
      ``,
      `Subtotal: ${formatMoney(subtotal, currency)}`,
      `Tax (${taxRate}%): ${formatMoney(taxAmount, currency)}`,
      `Total: ${formatMoney(total, currency)}`,
      ``,
      footer ? footer : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, [
    currency,
    customerName,
    date,
    footer,
    items,
    merchantAddress,
    merchantEmail,
    merchantName,
    paymentMethod,
    receiptNumber,
    subtotal,
    taxAmount,
    taxRate,
    total,
  ]);

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Inputs */}
      <div className="space-y-6 print:hidden">
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Merchant</h3>
          <div className="space-y-4">
            <div>
              <Label>Merchant Name</Label>
              <Input value={merchantName} onChange={(e) => setMerchantName(e.target.value)} placeholder="My Store" />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={merchantAddress}
                onChange={(e) => setMerchantAddress(e.target.value)}
                rows={2}
                placeholder={"Street\nCity, Country"}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={merchantEmail}
                onChange={(e) => setMerchantEmail(e.target.value)}
                placeholder="support@store.com"
              />
            </div>
          </div>
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Receipt Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Receipt Number</Label>
              <Input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Customer (optional)</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-foreground">Items</h3>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" /> Add Item
            </Button>
          </div>

          {/* Mobile cards */}
          <div className="space-y-4 sm:hidden">
            {items.map((it, idx) => (
              <div key={it.id} className="rounded-lg border border-border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Item {idx + 1}</p>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(it.id)} disabled={items.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={it.description}
                    onChange={(e) => updateItem(it.id, { description: e.target.value })}
                    placeholder="Product or service"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => updateItem(it.id, { quantity: Math.max(1, Number(e.target.value || 1)) })}
                    />
                  </div>
                  <div>
                    <Label>Unit Price</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.unitPrice}
                      onChange={(e) => updateItem(it.id, { unitPrice: Math.max(0, Number(e.target.value || 0)) })}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="text-sm font-semibold">{formatMoney(it.quantity * it.unitPrice, currency)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop grid */}
          <div className="hidden sm:block space-y-3">
            {items.map((it, index) => (
              <div key={it.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-6">
                  {index === 0 && <Label>Description</Label>}
                  <Input
                    value={it.description}
                    onChange={(e) => updateItem(it.id, { description: e.target.value })}
                    placeholder="Product or service"
                  />
                </div>
                <div className="col-span-2">
                  {index === 0 && <Label>Qty</Label>}
                  <Input
                    type="number"
                    min={1}
                    value={it.quantity}
                    onChange={(e) => updateItem(it.id, { quantity: Math.max(1, Number(e.target.value || 1)) })}
                  />
                </div>
                <div className="col-span-3">
                  {index === 0 && <Label>Unit Price</Label>}
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={it.unitPrice}
                    onChange={(e) => updateItem(it.id, { unitPrice: Math.max(0, Number(e.target.value || 0)) })}
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button variant="ghost" size="icon" onClick={() => removeItem(it.id)} disabled={items.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <Label>Footer (optional)</Label>
          <Textarea value={footer} onChange={(e) => setFooter(e.target.value)} rows={2} placeholder="Thank you!" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Button className="h-11" onClick={print}>
            <Printer className="h-4 w-4 mr-2" /> Print / PDF
          </Button>
          <Button variant="outline" className="h-11" onClick={() => copyToClipboard(receiptText)}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() =>
              downloadBlob(
                `receipt-${receiptNumber}.txt`,
                new Blob([receiptText], { type: "text/plain;charset=utf-8" }),
              )
            }
          >
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>
          <Button variant="outline" className="h-11" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="print-preview bg-white text-slate-900 rounded-xl border border-border p-6 sm:p-8">
        <div className="max-w-md mx-auto">
          <div className="text-center">
            <h2 className="text-xl font-bold">{merchantName || "Merchant"}</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{merchantAddress || "Address"}</p>
            {merchantEmail && <p className="text-sm text-muted-foreground">{merchantEmail}</p>}
          </div>

          <div className="mt-6 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receipt</span>
              <span className="font-medium">{receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{date}</span>
            </div>
            {customerName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{customerName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment</span>
              <span className="font-medium">{paymentMethod}</span>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-4 space-y-2 text-sm">
            {items.map((it) => (
              <div key={it.id} className="flex justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{it.description || "—"}</p>
                  <p className="text-muted-foreground">
                    {it.quantity} x {formatMoney(it.unitPrice, currency)}
                  </p>
                </div>
                <p className="font-semibold">{formatMoney(it.quantity * it.unitPrice, currency)}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-border pt-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax ({taxRate}%)</span>
              <span>{formatMoney(taxAmount, currency)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
          </div>

          {footer && (
            <div className="mt-6 border-t border-border pt-4 text-center text-sm text-muted-foreground whitespace-pre-line">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   Contract / Letter Generator
------------------------------*/
type ContractTemplate = "Service Agreement" | "Simple Contract" | "Formal Letter";

function ContractLetterGeneratorEmbedded() {
  const [template, setTemplate] = useState<ContractTemplate>("Service Agreement");

  const [senderName, setSenderName] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [senderEmail, setSenderEmail] = useState("");

  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

  const [date, setDate] = useState(todayISO());
  const [subject, setSubject] = useState("Re: Agreement");

  const [serviceDescription, setServiceDescription] = useState("Describe the services to be provided...");
  const [paymentTerms, setPaymentTerms] = useState("Payment due within 14 days of invoice.");
  const [term, setTerm] = useState("This agreement starts on the Effective Date and continues until completed.");
  const [governingLaw, setGoverningLaw] = useState("Governing law: Greece.");
  const [confidentiality, setConfidentiality] = useState(true);

  const [letterBody, setLetterBody] = useState("I'm writing regarding...");
  const [closing, setClosing] = useState("Sincerely,");

  const output = useMemo(() => {
    const senderBlock = [senderName, senderAddress, senderEmail ? `Email: ${senderEmail}` : ""]
      .filter(Boolean)
      .join("\n");
    const recipientBlock = [recipientName, recipientAddress, recipientEmail ? `Email: ${recipientEmail}` : ""]
      .filter(Boolean)
      .join("\n");

    if (template === "Formal Letter") {
      return [
        senderBlock || "Sender Name\nSender Address\nEmail: sender@email.com",
        "",
        date,
        "",
        recipientBlock || "Recipient Name\nRecipient Address\nEmail: recipient@email.com",
        "",
        `Subject: ${subject || "Subject"}`,
        "",
        letterBody || "",
        "",
        closing,
        senderName || "Sender Name",
      ].join("\n");
    }

    if (template === "Simple Contract") {
      return [
        `SIMPLE CONTRACT`,
        "",
        `Date: ${date}`,
        "",
        `Parties:`,
        `- ${senderName || "Party A"} ("Party A")`,
        `- ${recipientName || "Party B"} ("Party B")`,
        "",
        `1) Scope`,
        serviceDescription || "Describe scope...",
        "",
        `2) Payment`,
        paymentTerms || "Payment terms...",
        "",
        `3) Term`,
        term || "",
        "",
        confidentiality ? `4) Confidentiality\nBoth parties agree to keep confidential information private.\n` : "",
        `5) ${governingLaw || "Governing law: ______."}`,
        "",
        `Signatures`,
        "",
        `Party A: _______________________   Date: __________`,
        `Party B: _______________________   Date: __________`,
      ]
        .filter(Boolean)
        .join("\n");
    }

    return [
      `SERVICE AGREEMENT`,
      "",
      `Date: ${date}`,
      "",
      `This Service Agreement ("Agreement") is entered into between:`,
      `${senderName || "Service Provider"} ("Provider") and ${recipientName || "Client"} ("Client").`,
      "",
      `1) Services`,
      serviceDescription || "",
      "",
      `2) Fees & Payment`,
      paymentTerms || "",
      "",
      `3) Term`,
      term || "",
      "",
      confidentiality
        ? `4) Confidentiality\nEach party shall keep confidential information of the other party and not disclose it to third parties except as required by law.\n`
        : "",
      `5) Liability`,
      `Provider will perform services with reasonable care. Except for willful misconduct, total liability is limited to fees paid in the last 3 months.`,
      "",
      `6) ${governingLaw || "Governing law: ______."}`,
      "",
      `Signatures`,
      "",
      `Provider: _______________________   Date: __________`,
      `Client:   _______________________   Date: __________`,
    ]
      .filter(Boolean)
      .join("\n");
  }, [
    template,
    senderName,
    senderAddress,
    senderEmail,
    recipientName,
    recipientAddress,
    recipientEmail,
    date,
    subject,
    serviceDescription,
    paymentTerms,
    term,
    governingLaw,
    confidentiality,
    letterBody,
    closing,
  ]);

  const reset = () => {
    setTemplate("Service Agreement");
    setSenderName("");
    setSenderAddress("");
    setSenderEmail("");
    setRecipientName("");
    setRecipientAddress("");
    setRecipientEmail("");
    setDate(todayISO());
    setSubject("Re: Agreement");
    setServiceDescription("Describe the services to be provided...");
    setPaymentTerms("Payment due within 14 days of invoice.");
    setTerm("This agreement starts on the Effective Date and continues until completed.");
    setGoverningLaw("Governing law: Greece.");
    setConfidentiality(true);
    setLetterBody("I'm writing regarding...");
    setClosing("Sincerely,");
    toast.success("Reset");
  };

  const print = () => window.print();

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Inputs */}
      <div className="space-y-6 print:hidden">
        {/* Template selector */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Template</h3>
          <Select value={template} onValueChange={(v) => setTemplate(v as ContractTemplate)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Service Agreement">Service Agreement</SelectItem>
              <SelectItem value="Simple Contract">Simple Contract</SelectItem>
              <SelectItem value="Formal Letter">Formal Letter</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sender / Party A */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">
            {template === "Formal Letter"
              ? "From (Sender)"
              : template === "Simple Contract"
                ? "Party A"
                : "Service Provider"}
          </h3>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Your name or company"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={senderAddress}
                onChange={(e) => setSenderAddress(e.target.value)}
                rows={2}
                placeholder={"123 Street\nCity, Country"}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="you@email.com"
              />
            </div>
          </div>
        </div>

        {/* Recipient / Party B */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">
            {template === "Formal Letter" ? "To (Recipient)" : template === "Simple Contract" ? "Party B" : "Client"}
          </h3>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Recipient name or company"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                rows={2}
                placeholder={"456 Avenue\nCity, Country"}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="them@email.com"
              />
            </div>
          </div>
        </div>

        {/* Date + subject (letter) / contract fields */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Details</h3>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            {template === "Formal Letter" && (
              <>
                <div>
                  <Label>Subject</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Re: ..." />
                </div>
                <div>
                  <Label>Letter Body</Label>
                  <Textarea
                    value={letterBody}
                    onChange={(e) => setLetterBody(e.target.value)}
                    rows={5}
                    placeholder="Write your letter here..."
                  />
                </div>
                <div>
                  <Label>Closing</Label>
                  <Input value={closing} onChange={(e) => setClosing(e.target.value)} placeholder="Sincerely," />
                </div>
              </>
            )}

            {(template === "Service Agreement" || template === "Simple Contract") && (
              <>
                <div>
                  <Label>Scope / Service Description</Label>
                  <Textarea
                    value={serviceDescription}
                    onChange={(e) => setServiceDescription(e.target.value)}
                    rows={3}
                    placeholder="Describe services or scope..."
                  />
                </div>
                <div>
                  <Label>Payment Terms</Label>
                  <Textarea
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    rows={2}
                    placeholder="Payment due within..."
                  />
                </div>
                <div>
                  <Label>Term / Duration</Label>
                  <Textarea
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    rows={2}
                    placeholder="Duration of the agreement..."
                  />
                </div>
                <div>
                  <Label>Governing Law</Label>
                  <Input
                    value={governingLaw}
                    onChange={(e) => setGoverningLaw(e.target.value)}
                    placeholder="Governing law: ..."
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="contract-confidentiality"
                    checked={confidentiality}
                    onChange={(e) => setConfidentiality(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <Label htmlFor="contract-confidentiality" className="cursor-pointer">
                    Include Confidentiality Clause
                  </Label>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Button className="h-11" onClick={print}>
            <Printer className="h-4 w-4 mr-2" /> Print / PDF
          </Button>
          <Button variant="outline" className="h-11" onClick={() => copyToClipboard(output)}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() =>
              downloadBlob(
                `${template.toLowerCase().replace(/\s+/g, "-")}.txt`,
                new Blob([output], { type: "text/plain;charset=utf-8" }),
              )
            }
          >
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>
          <Button variant="outline" className="h-11" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="print-preview bg-white text-slate-900 rounded-xl border border-border p-6 sm:p-8">
        <pre className="tool-preview whitespace-pre-wrap break-words text-sm leading-relaxed">{output}</pre>
      </div>
    </div>
  );
}

/* -----------------------------
   NDA Generator (inlined)
------------------------------*/
function NDAGenerator() {
  const [partyAName, setPartyAName] = useState("");
  const [partyAAddress, setPartyAAddress] = useState("");
  const [partyBName, setPartyBName] = useState("");
  const [partyBAddress, setPartyBAddress] = useState("");
  const [date, setDate] = useState(todayISO());
  const [purpose, setPurpose] = useState("Evaluation of a potential business relationship.");
  const [duration, setDuration] = useState("2 years from the Effective Date.");
  const [governingLaw, setGoverningLaw] = useState("Governing law: Sweden.");
  const [ndaType, setNdaType] = useState<"Mutual" | "One-Way">("Mutual");

  const output = useMemo(() => {
    const header = ndaType === "Mutual" ? "MUTUAL NON-DISCLOSURE AGREEMENT" : "NON-DISCLOSURE AGREEMENT";
    const disclosureClause =
      ndaType === "Mutual"
        ? `Each Party may disclose Confidential Information to the other Party solely for the Purpose. Both Parties agree to maintain confidentiality and not disclose, copy, or use such information without prior written consent.`
        : `Party A may disclose Confidential Information to Party B solely for the Purpose. Party B agrees to maintain confidentiality and not disclose, copy, or use such information without prior written consent of Party A.`;

    return [
      header,
      "",
      `Effective Date: ${date}`,
      "",
      `Party A: ${partyAName || "Party A Name"}`,
      partyAAddress ? `Address: ${partyAAddress}` : "",
      "",
      `Party B: ${partyBName || "Party B Name"}`,
      partyBAddress ? `Address: ${partyBAddress}` : "",
      "",
      `1) Purpose`,
      purpose || "To be defined.",
      "",
      `2) Definition of Confidential Information`,
      `"Confidential Information" means any non-public information disclosed by one Party to the other, whether orally, in writing, electronically, or by any other means, that is designated as confidential or that reasonably should be understood to be confidential.`,
      "",
      `3) Obligations`,
      disclosureClause,
      "",
      `4) Exclusions`,
      `Confidential Information does not include information that: (a) is or becomes publicly known through no fault of the Receiving Party; (b) was already known to the Receiving Party prior to disclosure; (c) is independently developed by the Receiving Party; or (d) is required to be disclosed by law or court order.`,
      "",
      `5) Duration`,
      duration || "To be defined.",
      "",
      `6) ${governingLaw || "Governing law: ______."}`,
      "",
      `7) Remedies`,
      `Each Party acknowledges that a breach of this Agreement may cause irreparable harm and that the non-breaching Party shall be entitled to seek equitable remedies, including injunctive relief.`,
      "",
      `Signatures`,
      "",
      `Party A: _______________________   Date: __________`,
      `Party B: _______________________   Date: __________`,
    ]
      .filter(Boolean)
      .join("\n");
  }, [partyAName, partyAAddress, partyBName, partyBAddress, date, purpose, duration, governingLaw, ndaType]);

  const reset = () => {
    setPartyAName("");
    setPartyAAddress("");
    setPartyBName("");
    setPartyBAddress("");
    setDate(todayISO());
    setPurpose("Evaluation of a potential business relationship.");
    setDuration("2 years from the Effective Date.");
    setGoverningLaw("Governing law: Sweden.");
    setNdaType("Mutual");
    toast.success("NDA reset");
  };

  const print = () => window.print();

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="space-y-6 print:hidden">
        {/* NDA Type */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">NDA Type</h3>
          <Select value={ndaType} onValueChange={(v) => setNdaType(v as "Mutual" | "One-Way")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Mutual">Mutual (Both Parties)</SelectItem>
              <SelectItem value="One-Way">One-Way (Party A → Party B)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Party A */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Party A</h3>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={partyAName}
                onChange={(e) => setPartyAName(e.target.value)}
                placeholder="Company or individual name"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={partyAAddress}
                onChange={(e) => setPartyAAddress(e.target.value)}
                rows={2}
                placeholder={"Street\nCity, Country"}
              />
            </div>
          </div>
        </div>

        {/* Party B */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Party B</h3>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={partyBName}
                onChange={(e) => setPartyBName(e.target.value)}
                placeholder="Company or individual name"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={partyBAddress}
                onChange={(e) => setPartyBAddress(e.target.value)}
                rows={2}
                placeholder={"Street\nCity, Country"}
              />
            </div>
          </div>
        </div>

        {/* NDA Details */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">NDA Details</h3>
          <div className="space-y-4">
            <div>
              <Label>Effective Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Purpose</Label>
              <Textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={2}
                placeholder="Why is this NDA being signed?"
              />
            </div>
            <div>
              <Label>Duration</Label>
              <Input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="How long the NDA lasts..."
              />
            </div>
            <div>
              <Label>Governing Law</Label>
              <Input
                value={governingLaw}
                onChange={(e) => setGoverningLaw(e.target.value)}
                placeholder="Governing law: ..."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Button className="h-11" onClick={print}>
            <Printer className="h-4 w-4 mr-2" /> Print / PDF
          </Button>
          <Button variant="outline" className="h-11" onClick={() => copyToClipboard(output)}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => downloadBlob("nda.txt", new Blob([output], { type: "text/plain;charset=utf-8" }))}
          >
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>
          <Button variant="outline" className="h-11" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="print-preview bg-white text-slate-900 rounded-xl border border-border p-6 sm:p-8">
        <pre className="tool-preview whitespace-pre-wrap break-words text-sm leading-relaxed">{output}</pre>
      </div>
    </div>
  );
}

/* -----------------------------
   Proposal Generator (inlined)
------------------------------*/
function ProposalGenerator() {
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [date, setDate] = useState(todayISO());
  const [validUntil, setValidUntil] = useState("");
  const [projectTitle, setProjectTitle] = useState("Project Proposal");
  const [executiveSummary, setExecutiveSummary] = useState("Brief overview of the proposed project and objectives.");
  const [scopeOfWork, setScopeOfWork] = useState("Detailed description of deliverables and responsibilities.");
  const [timeline, setTimeline] = useState(
    "Phase 1: Planning – 2 weeks\nPhase 2: Development – 4 weeks\nPhase 3: Delivery – 1 week",
  );
  const [pricing, setPricing] = useState("Total project cost: To be discussed.");
  const [paymentTerms, setPaymentTerms] = useState("50% upfront, 50% upon delivery.");
  const [termsAndConditions, setTermsAndConditions] = useState(
    "This proposal is valid for the period stated above. All work is subject to a formal contract.",
  );

  const output = useMemo(() => {
    return [
      `BUSINESS PROPOSAL`,
      "",
      `${companyName || "Your Company"}`,
      companyAddress ? companyAddress : "",
      "",
      `Date: ${date}`,
      validUntil ? `Valid Until: ${validUntil}` : "",
      "",
      `Prepared for:`,
      `${clientName || "Client Name"}`,
      clientAddress ? clientAddress : "",
      "",
      `─────────────────────────────`,
      "",
      `Project: ${projectTitle}`,
      "",
      `1) Executive Summary`,
      executiveSummary || "",
      "",
      `2) Scope of Work`,
      scopeOfWork || "",
      "",
      `3) Timeline`,
      timeline || "",
      "",
      `4) Pricing`,
      pricing || "",
      "",
      `5) Payment Terms`,
      paymentTerms || "",
      "",
      `6) Terms & Conditions`,
      termsAndConditions || "",
      "",
      `─────────────────────────────`,
      "",
      `We look forward to working with you. Please do not hesitate to reach out with any questions.`,
      "",
      `Sincerely,`,
      `${companyName || "Your Company"}`,
    ]
      .filter(Boolean)
      .join("\n");
  }, [
    companyName,
    companyAddress,
    clientName,
    clientAddress,
    date,
    validUntil,
    projectTitle,
    executiveSummary,
    scopeOfWork,
    timeline,
    pricing,
    paymentTerms,
    termsAndConditions,
  ]);

  const reset = () => {
    setCompanyName("");
    setCompanyAddress("");
    setClientName("");
    setClientAddress("");
    setDate(todayISO());
    setValidUntil("");
    setProjectTitle("Project Proposal");
    setExecutiveSummary("Brief overview of the proposed project and objectives.");
    setScopeOfWork("Detailed description of deliverables and responsibilities.");
    setTimeline("Phase 1: Planning – 2 weeks\nPhase 2: Development – 4 weeks\nPhase 3: Delivery – 1 week");
    setPricing("Total project cost: To be discussed.");
    setPaymentTerms("50% upfront, 50% upon delivery.");
    setTermsAndConditions(
      "This proposal is valid for the period stated above. All work is subject to a formal contract.",
    );
    toast.success("Proposal reset");
  };

  const print = () => window.print();

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="space-y-6 print:hidden">
        {/* Your Company */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Your Company</h3>
          <div className="space-y-4">
            <div>
              <Label>Company Name</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your Company Ltd"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                rows={2}
                placeholder={"Street\nCity, Country"}
              />
            </div>
          </div>
        </div>

        {/* Client */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Client</h3>
          <div className="space-y-4">
            <div>
              <Label>Client Name</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client Company" />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                rows={2}
                placeholder={"Street\nCity, Country"}
              />
            </div>
          </div>
        </div>

        {/* Proposal Details */}
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Proposal Details</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label>Valid Until</Label>
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Project Title</Label>
              <Input
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="Project name..."
              />
            </div>
            <div>
              <Label>Executive Summary</Label>
              <Textarea
                value={executiveSummary}
                onChange={(e) => setExecutiveSummary(e.target.value)}
                rows={3}
                placeholder="Brief overview..."
              />
            </div>
            <div>
              <Label>Scope of Work</Label>
              <Textarea
                value={scopeOfWork}
                onChange={(e) => setScopeOfWork(e.target.value)}
                rows={3}
                placeholder="Deliverables and responsibilities..."
              />
            </div>
            <div>
              <Label>Timeline</Label>
              <Textarea
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                rows={3}
                placeholder={"Phase 1: ...\nPhase 2: ..."}
              />
            </div>
            <div>
              <Label>Pricing</Label>
              <Textarea
                value={pricing}
                onChange={(e) => setPricing(e.target.value)}
                rows={2}
                placeholder="Pricing breakdown..."
              />
            </div>
            <div>
              <Label>Payment Terms</Label>
              <Input
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="Payment schedule..."
              />
            </div>
            <div>
              <Label>Terms & Conditions</Label>
              <Textarea
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                rows={2}
                placeholder="Any terms or conditions..."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Button className="h-11" onClick={print}>
            <Printer className="h-4 w-4 mr-2" /> Print / PDF
          </Button>
          <Button variant="outline" className="h-11" onClick={() => copyToClipboard(output)}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => downloadBlob("proposal.txt", new Blob([output], { type: "text/plain;charset=utf-8" }))}
          >
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>
          <Button variant="outline" className="h-11" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="print-preview bg-white text-slate-900 rounded-xl border border-border p-6 sm:p-8">
        <pre className="tool-preview whitespace-pre-wrap break-words text-sm leading-relaxed">{output}</pre>
      </div>
    </div>
  );
}

/* -----------------------------
   Page wrapper with tabs
------------------------------*/
export default function BusinessDocs() {
  const tabScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = () => {
    const el = tabScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  };

  useEffect(() => {
    updateScrollButtons();
    const el = tabScrollRef.current;
    if (!el) return;

    const onScroll = () => updateScrollButtons();
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => updateScrollButtons());
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  const scrollTabsBy = (delta: number) => {
    const el = tabScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <ToolLayout title="Business Docs" description="Invoices, receipts, and contracts — all in one tool.">
      <PrintStyleTag />
      <Card>
        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue="invoice" className="w-full">
            <div className="mb-6">
              <div className="relative flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => scrollTabsBy(-240)}
                  disabled={!canScrollLeft}
                  className="h-9 w-9 shrink-0 rounded-full bg-background/80 backdrop-blur disabled:opacity-40"
                  aria-label="Scroll tabs left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="relative flex-1 min-w-0">
                  <div
                    className={[
                      "pointer-events-none absolute inset-y-0 left-0 w-8",
                      "bg-gradient-to-r from-background to-transparent",
                      canScrollLeft ? "opacity-100" : "opacity-0",
                      "transition-opacity",
                    ].join(" ")}
                  />
                  <div
                    className={[
                      "pointer-events-none absolute inset-y-0 right-0 w-8",
                      "bg-gradient-to-l from-background to-transparent",
                      canScrollRight ? "opacity-100" : "opacity-0",
                      "transition-opacity",
                    ].join(" ")}
                  />

                  <TabsList
                    ref={tabScrollRef as any}
                    className="w-full flex overflow-x-auto gap-1 p-1 h-11 whitespace-nowrap rounded-lg
                      [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    <TabsTrigger value="invoice" className="flex-1 min-w-max gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">Invoice</span>
                    </TabsTrigger>
                    <TabsTrigger value="receipt" className="flex-1 min-w-max gap-2">
                      <Receipt className="h-4 w-4" />
                      <span className="hidden sm:inline">Receipt</span>
                    </TabsTrigger>
                    <TabsTrigger value="contract" className="flex-1 min-w-max gap-2">
                      <FileSignature className="h-4 w-4" />
                      <span className="hidden sm:inline">Contract</span>
                    </TabsTrigger>
                    <TabsTrigger value="nda" className="flex-1 min-w-max gap-2">
                      <Shield className="h-4 w-4" />
                      <span className="hidden sm:inline">NDA</span>
                    </TabsTrigger>
                    <TabsTrigger value="proposal" className="flex-1 min-w-max gap-2">
                      <Presentation className="h-4 w-4" />
                      <span className="hidden sm:inline">Proposal</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => scrollTabsBy(240)}
                  disabled={!canScrollRight}
                  className="h-9 w-9 shrink-0 rounded-full bg-background/80 backdrop-blur disabled:opacity-40"
                  aria-label="Scroll tabs right"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {(canScrollLeft || canScrollRight) && (
                <p className="mt-2 text-xs text-muted-foreground">Swipe tabs or use arrows.</p>
              )}
            </div>

            <TabsContent value="invoice" className="space-y-6">
              <InvoiceGeneratorEmbedded />
            </TabsContent>

            <TabsContent value="receipt" className="space-y-6">
              <ReceiptGeneratorEmbedded />
            </TabsContent>

            <TabsContent value="contract" className="space-y-6">
              <ContractLetterGeneratorEmbedded />
            </TabsContent>

            <TabsContent value="nda" className="space-y-6">
              <NDAGenerator />
            </TabsContent>

            <TabsContent value="proposal" className="space-y-6">
              <ProposalGenerator />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </ToolLayout>
  );
}
