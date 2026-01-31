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

import { NDAGenerator } from "@/components/business-docs/NDAGenerator";
import { ProposalGenerator } from "@/components/business-docs/ProposalGenerator";

/** Moat layer (adjust paths if your project differs) */
import { useMoat } from "@/hooks/moat/useMoat";
import { PresetsPanel } from "@/components/moat/PresetsPanel";
import { CopyLinkButton } from "@/components/moat/CopyLinkButton";
import { LocalStatusIndicator } from "@/components/moat/LocalStatusIndicator";

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

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
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
   INVOICE (MOAT ENABLED)
------------------------------*/
type InvoiceSettings = {
  sellerName: string;
  sellerAddress: string;
  sellerEmail: string;

  clientName: string;
  clientAddress: string;
  clientEmail: string;

  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;

  currency: CurrencyCode;
  vatRate: number;

  notes: string;
  lineItems: LineItem[];
};

const DEFAULT_SETTINGS_INVOICE: InvoiceSettings = {
  sellerName: "",
  sellerAddress: "",
  sellerEmail: "",

  clientName: "",
  clientAddress: "",
  clientEmail: "",

  invoiceNumber: "INV-001",
  invoiceDate: todayISO(),
  dueDate: "",

  currency: "EUR",
  vatRate: 20,

  notes: "",
  lineItems: [{ id: "1", description: "", quantity: 1, unitPrice: 0 }],
};

const RECOMMENDED_PRESETS_INVOICE = [
  {
    name: "Freelancer EU VAT 20%",
    settings: {
      ...DEFAULT_SETTINGS_INVOICE,
      currency: "EUR",
      vatRate: 20,
      notes: "Payment due within 14 days.\nIBAN: ________\nThank you!",
      lineItems: [{ id: "1", description: "Consulting services", quantity: 1, unitPrice: 0 }],
    } satisfies InvoiceSettings,
  },
  {
    name: "US No Tax",
    settings: {
      ...DEFAULT_SETTINGS_INVOICE,
      currency: "USD",
      vatRate: 0,
      notes: "Payment due within 14 days.\nThank you!",
      lineItems: [{ id: "1", description: "Professional services", quantity: 1, unitPrice: 0 }],
    } satisfies InvoiceSettings,
  },
  {
    name: "Consulting Invoice",
    settings: {
      ...DEFAULT_SETTINGS_INVOICE,
      currency: "EUR",
      vatRate: 0,
      notes: "Payment terms: Net 30.\nPlease include invoice number on transfer.",
      lineItems: [
        { id: "1", description: "Discovery & planning", quantity: 1, unitPrice: 0 },
        { id: "2", description: "Implementation", quantity: 1, unitPrice: 0 },
      ],
    } satisfies InvoiceSettings,
  },
];

function InvoiceGeneratorEmbedded() {
  const toolSlug = "business-docs-invoice";

  const [settings, setSettings] = useState<InvoiceSettings>(DEFAULT_SETTINGS_INVOICE);

  const moat = useMoat(settings, setSettings, {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS_INVOICE,
    recommendedPresets: RECOMMENDED_PRESETS_INVOICE,
  });

  const update = <K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const subtotal = useMemo(
    () => settings.lineItems.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0),
    [settings.lineItems],
  );
  const vatAmount = useMemo(() => subtotal * (settings.vatRate / 100), [subtotal, settings.vatRate]);
  const total = useMemo(() => subtotal + vatAmount, [subtotal, vatAmount]);

  const addLine = () => {
    setSettings((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0 }],
    }));
  };

  const removeLine = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      lineItems: prev.lineItems.length <= 1 ? prev.lineItems : prev.lineItems.filter((x) => x.id !== id),
    }));
  };

  const updateLine = (id: string, patch: Partial<LineItem>) => {
    setSettings((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  };

  const reset = () => {
    setSettings({ ...DEFAULT_SETTINGS_INVOICE, invoiceDate: todayISO() });
    toast.success("Invoice reset");
  };

  const invoiceText = useMemo(() => {
    const lines = settings.lineItems
      .map(
        (it) =>
          `- ${it.description || "—"} | Qty ${it.quantity} x ${formatMoney(it.unitPrice, settings.currency)} = ${formatMoney(
            it.quantity * it.unitPrice,
            settings.currency,
          )}`,
      )
      .join("\n");

    return [
      `INVOICE ${settings.invoiceNumber}`,
      ``,
      `From: ${settings.sellerName || "Your Company"}`,
      `${settings.sellerAddress || ""}`.trim(),
      settings.sellerEmail ? `Email: ${settings.sellerEmail}` : "",
      ``,
      `Bill To: ${settings.clientName || "Client Name"}`,
      `${settings.clientAddress || ""}`.trim(),
      settings.clientEmail ? `Email: ${settings.clientEmail}` : "",
      ``,
      `Date: ${settings.invoiceDate}`,
      settings.dueDate ? `Due: ${settings.dueDate}` : "",
      ``,
      `Items:`,
      lines || "- —",
      ``,
      `Subtotal: ${formatMoney(subtotal, settings.currency)}`,
      `VAT (${settings.vatRate}%): ${formatMoney(vatAmount, settings.currency)}`,
      `Total: ${formatMoney(total, settings.currency)}`,
      ``,
      settings.notes ? `Notes:\n${settings.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, [settings, subtotal, vatAmount, total]);

  const doPrint = () => {
    window.print();
    moat?.recordJob?.({
      action: "print",
      toolSlug,
      inputMeta: [],
    });
  };

  const doCopy = async () => {
    await copyToClipboard(invoiceText);
    moat?.recordJob?.({
      action: "copy",
      toolSlug,
      inputMeta: [],
    });
  };

  const doDownload = () => {
    downloadBlob(
      `invoice-${settings.invoiceNumber}.txt`,
      new Blob([invoiceText], { type: "text/plain;charset=utf-8" }),
    );
    toast.success("Downloaded");
    moat?.recordJob?.({
      action: "download",
      toolSlug,
      inputMeta: [],
    });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Presets */}
      <div className="order-3 lg:order-1 print:hidden">
        <LocalStatusIndicator />
        <div className="mt-3">
          <PresetsPanel />
        </div>
        <div className="mt-3">
          <CopyLinkButton toolSlug={toolSlug} currentSettings={settings} />
        </div>
      </div>

      {/* INPUTS */}
      <div className="space-y-6 print:hidden order-1 lg:order-2">
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Your Information</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="inv-sellerName">Company / Name</Label>
              <Input
                id="inv-sellerName"
                value={settings.sellerName}
                onChange={(e) => update("sellerName", e.target.value)}
                placeholder="Your Company Ltd"
              />
            </div>
            <div>
              <Label htmlFor="inv-sellerAddress">Address</Label>
              <Textarea
                id="inv-sellerAddress"
                value={settings.sellerAddress}
                onChange={(e) => update("sellerAddress", e.target.value)}
                placeholder={"123 Business Street\nCity, Country"}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="inv-sellerEmail">Email</Label>
              <Input
                id="inv-sellerEmail"
                type="email"
                value={settings.sellerEmail}
                onChange={(e) => update("sellerEmail", e.target.value)}
                placeholder="billing@company.com"
              />
            </div>
          </div>
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Client Information</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="inv-clientName">Client Name</Label>
              <Input
                id="inv-clientName"
                value={settings.clientName}
                onChange={(e) => update("clientName", e.target.value)}
                placeholder="Client Company"
              />
            </div>
            <div>
              <Label htmlFor="inv-clientAddress">Address</Label>
              <Textarea
                id="inv-clientAddress"
                value={settings.clientAddress}
                onChange={(e) => update("clientAddress", e.target.value)}
                placeholder={"456 Client Avenue\nCity, Country"}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="inv-clientEmail">Email</Label>
              <Input
                id="inv-clientEmail"
                type="email"
                value={settings.clientEmail}
                onChange={(e) => update("clientEmail", e.target.value)}
                placeholder="contact@client.com"
              />
            </div>
          </div>
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Invoice Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="inv-number">Invoice Number</Label>
              <Input
                id="inv-number"
                value={settings.invoiceNumber}
                onChange={(e) => update("invoiceNumber", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="inv-currency">Currency</Label>
              <Select value={settings.currency} onValueChange={(v) => update("currency", v as CurrencyCode)}>
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
              <Input
                id="inv-date"
                type="date"
                value={settings.invoiceDate}
                onChange={(e) => update("invoiceDate", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="inv-due">Due Date</Label>
              <Input
                id="inv-due"
                type="date"
                value={settings.dueDate}
                onChange={(e) => update("dueDate", e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="inv-vat">VAT Rate (%)</Label>
              <Input
                id="inv-vat"
                type="number"
                min={0}
                max={100}
                value={settings.vatRate}
                onChange={(e) => update("vatRate", Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-foreground">Line Items</h3>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-2" /> Add Line
            </Button>
          </div>

          <div className="space-y-4 sm:hidden">
            {settings.lineItems.map((it, idx) => (
              <div key={it.id} className="rounded-lg border border-border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Item {idx + 1}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(it.id)}
                    disabled={settings.lineItems.length === 1}
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
                  <span className="text-sm font-semibold">
                    {formatMoney(it.quantity * it.unitPrice, settings.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block space-y-3">
            {settings.lineItems.map((it, index) => (
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
                    disabled={settings.lineItems.length === 1}
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <Label htmlFor="inv-notes">Notes / Payment Terms</Label>
          <Textarea
            id="inv-notes"
            value={settings.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Payment due within 30 days..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button onClick={doPrint} className="h-11 sm:col-span-1">
            <Printer className="h-4 w-4 mr-2" /> Print / PDF
          </Button>
          <Button variant="outline" className="h-11 sm:col-span-1" onClick={doCopy}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
          <Button variant="outline" className="h-11 sm:col-span-1" onClick={doDownload}>
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>

          <Button variant="outline" className="h-11 sm:col-span-3" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset
          </Button>
        </div>
      </div>

      {/* PREVIEW */}
      <div className="bg-white text-slate-900 rounded-xl border border-border p-6 sm:p-8 print:p-0 print:border-none max-h-[700px] overflow-y-auto order-2 lg:order-3">
        <div className="space-y-6">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-slate-900 break-words">{settings.sellerName || "Your Company"}</h2>
              <p className="text-slate-600 whitespace-pre-line text-sm mt-1">
                {settings.sellerAddress || "Your address"}
              </p>
              {settings.sellerEmail && <p className="text-slate-600 text-sm break-words">{settings.sellerEmail}</p>}
            </div>
            <div className="text-right shrink-0">
              <h1 className="text-3xl font-bold text-primary">INVOICE</h1>
              <p className="text-slate-900 font-medium mt-2">{settings.invoiceNumber}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-border">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Bill To:</h3>
              <p className="font-medium">{settings.clientName || "Client Name"}</p>
              <p className="text-slate-600 whitespace-pre-line text-sm">{settings.clientAddress || "Client address"}</p>
              {settings.clientEmail && <p className="text-slate-600 text-sm break-words">{settings.clientEmail}</p>}
            </div>
            <div className="sm:text-right">
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-slate-600">Date:</span>{" "}
                  <span className="font-medium">{settings.invoiceDate}</span>
                </p>
                {settings.dueDate && (
                  <p>
                    <span className="text-slate-600">Due:</span> <span className="font-medium">{settings.dueDate}</span>
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
                {settings.lineItems.map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="p-3 text-sm">{it.description || "—"}</td>
                    <td className="p-3 text-sm text-right">{it.quantity}</td>
                    <td className="p-3 text-sm text-right">{formatMoney(it.unitPrice, settings.currency)}</td>
                    <td className="p-3 text-sm text-right font-medium">
                      {formatMoney(it.quantity * it.unitPrice, settings.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span>{formatMoney(subtotal, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">VAT ({settings.vatRate}%)</span>
                <span>{formatMoney(vatAmount, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                <span>Total</span>
                <span className="text-primary">{formatMoney(total, settings.currency)}</span>
              </div>
            </div>
          </div>

          {settings.notes && (
            <div className="pt-4 border-t border-border">
              <h3 className="font-semibold text-slate-900 mb-2">Notes</h3>
              <p className="text-slate-600 text-sm whitespace-pre-line">{settings.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   RECEIPT (MOAT ENABLED)
------------------------------*/
type ReceiptSettings = {
  merchantName: string;
  merchantAddress: string;
  merchantEmail: string;

  receiptNumber: string;
  date: string;
  currency: CurrencyCode;

  customerName: string;
  paymentMethod: "Card" | "Cash" | "Bank Transfer" | "Other";
  taxRate: number;

  items: LineItem[];
  footer: string;
};

const DEFAULT_SETTINGS_RECEIPT: ReceiptSettings = {
  merchantName: "",
  merchantAddress: "",
  merchantEmail: "",

  receiptNumber: "RCP-001",
  date: todayISO(),
  currency: "EUR",

  customerName: "",
  paymentMethod: "Card",
  taxRate: 0,

  items: [{ id: "1", description: "", quantity: 1, unitPrice: 0 }],
  footer: "Thank you for your purchase!",
};

const RECOMMENDED_PRESETS_RECEIPT = [
  {
    name: "Retail Cash",
    settings: {
      ...DEFAULT_SETTINGS_RECEIPT,
      paymentMethod: "Cash",
      footer: "Thanks! Returns within 14 days with receipt.",
    } satisfies ReceiptSettings,
  },
  {
    name: "Card + VAT 20",
    settings: {
      ...DEFAULT_SETTINGS_RECEIPT,
      paymentMethod: "Card",
      taxRate: 20,
      footer: "Thank you!",
    } satisfies ReceiptSettings,
  },
  {
    name: "Service Receipt",
    settings: {
      ...DEFAULT_SETTINGS_RECEIPT,
      taxRate: 0,
      items: [{ id: "1", description: "Service fee", quantity: 1, unitPrice: 0 }],
      footer: "Payment received. Thank you for your business!",
    } satisfies ReceiptSettings,
  },
];

function ReceiptGeneratorEmbedded() {
  const toolSlug = "business-docs-receipt";

  const [settings, setSettings] = useState<ReceiptSettings>(DEFAULT_SETTINGS_RECEIPT);

  const moat = useMoat(settings, setSettings, {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS_RECEIPT,
    recommendedPresets: RECOMMENDED_PRESETS_RECEIPT,
  });

  const update = <K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const subtotal = useMemo(
    () => settings.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0),
    [settings.items],
  );
  const taxAmount = useMemo(() => subtotal * (settings.taxRate / 100), [subtotal, settings.taxRate]);
  const total = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);

  const addItem = () =>
    setSettings((p) => ({
      ...p,
      items: [...p.items, { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0 }],
    }));

  const removeItem = (id: string) =>
    setSettings((p) => ({
      ...p,
      items: p.items.length <= 1 ? p.items : p.items.filter((x) => x.id !== id),
    }));

  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setSettings((p) => ({
      ...p,
      items: p.items.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));

  const reset = () => {
    setSettings({ ...DEFAULT_SETTINGS_RECEIPT, date: todayISO() });
    toast.success("Receipt reset");
  };

  const receiptText = useMemo(() => {
    const lines = settings.items
      .map(
        (it) =>
          `- ${it.description || "—"} | Qty ${it.quantity} x ${formatMoney(it.unitPrice, settings.currency)} = ${formatMoney(
            it.quantity * it.unitPrice,
            settings.currency,
          )}`,
      )
      .join("\n");

    return [
      `RECEIPT ${settings.receiptNumber}`,
      ``,
      `${settings.merchantName || "Merchant"}`,
      `${settings.merchantAddress || ""}`.trim(),
      settings.merchantEmail ? `Email: ${settings.merchantEmail}` : "",
      ``,
      `Date: ${settings.date}`,
      settings.customerName ? `Customer: ${settings.customerName}` : "",
      `Payment: ${settings.paymentMethod}`,
      ``,
      `Items:`,
      lines || "- —",
      ``,
      `Subtotal: ${formatMoney(subtotal, settings.currency)}`,
      `Tax (${settings.taxRate}%): ${formatMoney(taxAmount, settings.currency)}`,
      `Total: ${formatMoney(total, settings.currency)}`,
      ``,
      settings.footer ? settings.footer : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, [settings, subtotal, taxAmount, total]);

  const doPrint = () => {
    window.print();
    moat?.recordJob?.({ action: "print", toolSlug, inputMeta: [] });
  };

  const doCopy = async () => {
    await copyToClipboard(receiptText);
    moat?.recordJob?.({ action: "copy", toolSlug, inputMeta: [] });
  };

  const doDownload = () => {
    downloadBlob(
      `receipt-${settings.receiptNumber}.txt`,
      new Blob([receiptText], { type: "text/plain;charset=utf-8" }),
    );
    toast.success("Downloaded");
    moat?.recordJob?.({ action: "download", toolSlug, inputMeta: [] });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Presets */}
      <div className="order-3 lg:order-1 print:hidden">
        <LocalStatusIndicator />
        <div className="mt-3">
          <PresetsPanel />
        </div>
        <div className="mt-3">
          <CopyLinkButton toolSlug={toolSlug} currentSettings={settings} />
        </div>
      </div>

      {/* Inputs */}
      <div className="space-y-6 print:hidden order-1 lg:order-2">
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Merchant</h3>
          <div className="space-y-4">
            <div>
              <Label>Merchant Name</Label>
              <Input
                value={settings.merchantName}
                onChange={(e) => update("merchantName", e.target.value)}
                placeholder="My Store"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={settings.merchantAddress}
                onChange={(e) => update("merchantAddress", e.target.value)}
                rows={2}
                placeholder={"Street\nCity, Country"}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={settings.merchantEmail}
                onChange={(e) => update("merchantEmail", e.target.value)}
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
              <Input value={settings.receiptNumber} onChange={(e) => update("receiptNumber", e.target.value)} />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={settings.currency} onValueChange={(v) => update("currency", v as CurrencyCode)}>
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
              <Input type="date" value={settings.date} onChange={(e) => update("date", e.target.value)} />
            </div>
            <div>
              <Label>Customer (optional)</Label>
              <Input
                value={settings.customerName}
                onChange={(e) => update("customerName", e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={settings.paymentMethod} onValueChange={(v) => update("paymentMethod", v as any)}>
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
                value={settings.taxRate}
                onChange={(e) => update("taxRate", Number(e.target.value))}
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

          <div className="space-y-4 sm:hidden">
            {settings.items.map((it, idx) => (
              <div key={it.id} className="rounded-lg border border-border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Item {idx + 1}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(it.id)}
                    disabled={settings.items.length === 1}
                  >
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
                  <span className="text-sm font-semibold">
                    {formatMoney(it.quantity * it.unitPrice, settings.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block space-y-3">
            {settings.items.map((it, index) => (
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(it.id)}
                    disabled={settings.items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <Label>Footer (optional)</Label>
          <Textarea
            value={settings.footer}
            onChange={(e) => update("footer", e.target.value)}
            rows={2}
            placeholder="Thank you!"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Button className="h-11" onClick={doPrint}>
            <Printer className="h-4 w-4 mr-2" /> Print / PDF
          </Button>
          <Button variant="outline" className="h-11" onClick={doCopy}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
          <Button variant="outline" className="h-11" onClick={doDownload}>
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>
          <Button variant="outline" className="h-11" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white text-slate-900 rounded-xl border border-border p-6 sm:p-8 print:p-0 print:border-none order-2 lg:order-3">
        <div className="max-w-md mx-auto">
          <div className="text-center">
            <h2 className="text-xl font-bold">{settings.merchantName || "Merchant"}</h2>
            <p className="text-sm text-slate-600 whitespace-pre-line">{settings.merchantAddress || "Address"}</p>
            {settings.merchantEmail && <p className="text-sm text-slate-600">{settings.merchantEmail}</p>}
          </div>

          <div className="mt-6 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">Receipt</span>
              <span className="font-medium">{settings.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Date</span>
              <span className="font-medium">{settings.date}</span>
            </div>
            {settings.customerName && (
              <div className="flex justify-between">
                <span className="text-slate-600">Customer</span>
                <span className="font-medium">{settings.customerName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-600">Payment</span>
              <span className="font-medium">{settings.paymentMethod}</span>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-4 space-y-2 text-sm">
            {settings.items.map((it) => (
              <div key={it.id} className="flex justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{it.description || "—"}</p>
                  <p className="text-slate-600">
                    {it.quantity} x {formatMoney(it.unitPrice, settings.currency)}
                  </p>
                </div>
                <p className="font-semibold">{formatMoney(it.quantity * it.unitPrice, settings.currency)}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-border pt-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span>{formatMoney(subtotal, settings.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Tax ({settings.taxRate}%)</span>
              <span>{formatMoney(taxAmount, settings.currency)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatMoney(total, settings.currency)}</span>
            </div>
          </div>

          {settings.footer && (
            <div className="mt-6 border-t border-border pt-4 text-center text-sm text-slate-600 whitespace-pre-line">
              {settings.footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   CONTRACT / LETTER (MOAT ENABLED)
------------------------------*/
type ContractTemplate = "Service Agreement" | "Simple Contract" | "Formal Letter";

type ContractSettings = {
  template: ContractTemplate;

  senderName: string;
  senderAddress: string;
  senderEmail: string;

  recipientName: string;
  recipientAddress: string;
  recipientEmail: string;

  date: string;
  subject: string;

  serviceDescription: string;
  paymentTerms: string;
  term: string;
  governingLaw: string;
  confidentiality: boolean;

  letterBody: string;
  closing: string;
};

const DEFAULT_SETTINGS_CONTRACT: ContractSettings = {
  template: "Service Agreement",

  senderName: "",
  senderAddress: "",
  senderEmail: "",

  recipientName: "",
  recipientAddress: "",
  recipientEmail: "",

  date: todayISO(),
  subject: "Re: Agreement",

  serviceDescription: "Describe the services to be provided...",
  paymentTerms: "Payment due within 14 days of invoice.",
  term: "This agreement starts on the Effective Date and continues until completed.",
  governingLaw: "Governing law: Greece.",
  confidentiality: true,

  letterBody: "I’m writing regarding...",
  closing: "Sincerely,",
};

const RECOMMENDED_PRESETS_CONTRACT = [
  {
    name: "Service Agreement",
    settings: {
      ...DEFAULT_SETTINGS_CONTRACT,
      template: "Service Agreement",
      confidentiality: true,
    } satisfies ContractSettings,
  },
  {
    name: "Simple Contract",
    settings: {
      ...DEFAULT_SETTINGS_CONTRACT,
      template: "Simple Contract",
      confidentiality: false,
      governingLaw: "Governing law: Greece.",
    } satisfies ContractSettings,
  },
  {
    name: "Formal Letter",
    settings: {
      ...DEFAULT_SETTINGS_CONTRACT,
      template: "Formal Letter",
      subject: "Regarding our agreement",
      letterBody: "Dear ______,\n\nI’m writing regarding...\n\nBest regards,",
      closing: "Best regards,",
    } satisfies ContractSettings,
  },
];

function ContractLetterGeneratorEmbedded() {
  const toolSlug = "business-docs-contract";

  const [settings, setSettings] = useState<ContractSettings>(DEFAULT_SETTINGS_CONTRACT);

  const moat = useMoat(settings, setSettings, {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS_CONTRACT,
    recommendedPresets: RECOMMENDED_PRESETS_CONTRACT,
  });

  const update = <K extends keyof ContractSettings>(key: K, value: ContractSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const output = useMemo(() => {
    const senderBlock = [
      settings.senderName,
      settings.senderAddress,
      settings.senderEmail ? `Email: ${settings.senderEmail}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const recipientBlock = [
      settings.recipientName,
      settings.recipientAddress,
      settings.recipientEmail ? `Email: ${settings.recipientEmail}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (settings.template === "Formal Letter") {
      return [
        senderBlock || "Sender Name\nSender Address\nEmail: sender@email.com",
        "",
        settings.date,
        "",
        recipientBlock || "Recipient Name\nRecipient Address\nEmail: recipient@email.com",
        "",
        `Subject: ${settings.subject || "Subject"}`,
        "",
        settings.letterBody || "",
        "",
        settings.closing,
        settings.senderName || "Sender Name",
      ].join("\n");
    }

    if (settings.template === "Simple Contract") {
      return [
        `SIMPLE CONTRACT`,
        "",
        `Date: ${settings.date}`,
        "",
        `Parties:`,
        `- ${settings.senderName || "Party A"} ("Party A")`,
        `- ${settings.recipientName || "Party B"} ("Party B")`,
        "",
        `1) Scope`,
        settings.serviceDescription || "Describe scope...",
        "",
        `2) Payment`,
        settings.paymentTerms || "Payment terms...",
        "",
        `3) Term`,
        settings.term || "",
        "",
        settings.confidentiality
          ? `4) Confidentiality\nBoth parties agree to keep confidential information private.\n`
          : "",
        `5) ${settings.governingLaw || "Governing law: ______."}`,
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
      `Date: ${settings.date}`,
      "",
      `This Service Agreement ("Agreement") is entered into between:`,
      `${settings.senderName || "Service Provider"} ("Provider") and ${settings.recipientName || "Client"} ("Client").`,
      "",
      `1) Services`,
      settings.serviceDescription || "",
      "",
      `2) Fees & Payment`,
      settings.paymentTerms || "",
      "",
      `3) Term`,
      settings.term || "",
      "",
      settings.confidentiality
        ? `4) Confidentiality\nEach party shall keep confidential information of the other party and not disclose it to third parties except as required by law.\n`
        : "",
      `5) Liability`,
      `Provider will perform services with reasonable care. Except for willful misconduct, total liability is limited to fees paid in the last 3 months.`,
      "",
      `6) ${settings.governingLaw || "Governing law: ______."}`,
      "",
      `Signatures`,
      "",
      `Provider: _______________________   Date: __________`,
      `Client:   _______________________   Date: __________`,
    ]
      .filter(Boolean)
      .join("\n");
  }, [settings]);

  const reset = () => {
    setSettings({ ...DEFAULT_SETTINGS_CONTRACT, date: todayISO() });
    toast.success("Reset");
  };

  const doPrint = () => {
    window.print();
    moat?.recordJob?.({ action: "print", toolSlug, inputMeta: [] });
  };

  const doCopy = async () => {
    await copyToClipboard(output);
    moat?.recordJob?.({ action: "copy", toolSlug, inputMeta: [] });
  };

  const doDownload = () => {
    downloadBlob(
      `${settings.template.toLowerCase().replace(/\s+/g, "-")}.txt`,
      new Blob([output], { type: "text/plain;charset=utf-8" }),
    );
    toast.success("Downloaded");
    moat?.recordJob?.({ action: "download", toolSlug, inputMeta: [] });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Presets */}
      <div className="order-3 lg:order-1 print:hidden">
        <LocalStatusIndicator />
        <div className="mt-3">
          <PresetsPanel />
        </div>
        <div className="mt-3">
          <CopyLinkButton toolSlug={toolSlug} currentSettings={settings} />
        </div>
      </div>

      {/* Inputs */}
      <div className="space-y-6 print:hidden order-1 lg:order-2">
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Template</h3>
          <Select value={settings.template} onValueChange={(v) => update("template", v as ContractTemplate)}>
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

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Sender</h3>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={settings.senderName} onChange={(e) => update("senderName", e.target.value)} />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={settings.senderAddress}
                onChange={(e) => update("senderAddress", e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={settings.senderEmail}
                onChange={(e) => update("senderEmail", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Recipient</h3>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={settings.recipientName} onChange={(e) => update("recipientName", e.target.value)} />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={settings.recipientAddress}
                onChange={(e) => update("recipientAddress", e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={settings.recipientEmail}
                onChange={(e) => update("recipientEmail", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Core Fields</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={settings.date} onChange={(e) => update("date", e.target.value)} />
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={settings.subject} onChange={(e) => update("subject", e.target.value)} />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <Label>Service Description</Label>
              <Textarea
                value={settings.serviceDescription}
                onChange={(e) => update("serviceDescription", e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label>Payment Terms</Label>
              <Textarea
                value={settings.paymentTerms}
                onChange={(e) => update("paymentTerms", e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label>Term</Label>
              <Textarea value={settings.term} onChange={(e) => update("term", e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Governing Law</Label>
              <Input value={settings.governingLaw} onChange={(e) => update("governingLaw", e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="conf"
                type="checkbox"
                checked={settings.confidentiality}
                onChange={(e) => update("confidentiality", e.target.checked)}
              />
              <Label htmlFor="conf">Include confidentiality</Label>
            </div>

            {settings.template === "Formal Letter" && (
              <>
                <div>
                  <Label>Letter Body</Label>
                  <Textarea
                    value={settings.letterBody}
                    onChange={(e) => update("letterBody", e.target.value)}
                    rows={6}
                  />
                </div>
                <div>
                  <Label>Closing</Label>
                  <Input value={settings.closing} onChange={(e) => update("closing", e.target.value)} />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Button className="h-11" onClick={doPrint}>
            <Printer className="h-4 w-4 mr-2" /> Print / PDF
          </Button>
          <Button variant="outline" className="h-11" onClick={doCopy}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
          <Button variant="outline" className="h-11" onClick={doDownload}>
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>
          <Button variant="outline" className="h-11" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white text-slate-900 rounded-xl border border-border p-6 sm:p-8 print:p-0 print:border-none order-2 lg:order-3">
        <pre className="whitespace-pre-wrap text-sm leading-relaxed">{output}</pre>
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

            {/* Leave as-is for now (imported components) */}
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
