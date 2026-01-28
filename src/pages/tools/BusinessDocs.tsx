import { useEffect, useRef, useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, RotateCcw, Printer, FileText, Receipt, FileSignature, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

const currencies = [
  { code: "EUR", symbol: "€" },
  { code: "USD", symbol: "$" },
  { code: "GBP", symbol: "£" },
  { code: "CHF", symbol: "CHF" },
];

export default function BusinessDocs() {
  // Tab scroll affordance (same pattern as you wanted)
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

  // -------------------------
  // INVOICE STATE (your existing generator, embedded)
  // -------------------------
  const [sellerName, setSellerName] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("INV-001");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [vatRate, setVatRate] = useState(20);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ id: "1", description: "", quantity: 1, unitPrice: 0 }]);

  const currencySymbol = currencies.find((c) => c.code === currency)?.symbol || "€";

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(lineItems.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;

  const formatCurrency = (amount: number) => `${currencySymbol}${amount.toFixed(2)}`;

  const resetInvoice = () => {
    setSellerName("");
    setSellerAddress("");
    setSellerEmail("");
    setClientName("");
    setClientAddress("");
    setClientEmail("");
    setInvoiceNumber("INV-001");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setCurrency("EUR");
    setVatRate(20);
    setNotes("");
    setLineItems([{ id: "1", description: "", quantity: 1, unitPrice: 0 }]);
    toast.success("Invoice reset");
  };

  const printInvoice = () => window.print();

  return (
    <ToolLayout title="Business Docs" description="Invoices, receipts, and contracts — in one place.">
      <Card>
        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue="invoice" className="w-full">
            {/* Tab bar (same UX as GeneratorTools, but with scroll hint + arrows) */}
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
                    className="w-full mb-0 flex overflow-x-auto gap-1 p-1 h-11 whitespace-nowrap rounded-lg
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
                      <span className="hidden sm:inline">Contract / Letter</span>
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

            {/* ---------------- INVOICE TAB ---------------- */}
            <TabsContent value="invoice" className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Input Panel */}
                <div className="space-y-6 print:hidden">
                  {/* Seller Info */}
                  <div className="bg-surface-elevated rounded-xl p-6 border border-border">
                    <h3 className="font-semibold text-foreground mb-4">Your Information</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="sellerName">Company / Name</Label>
                        <Input
                          id="sellerName"
                          value={sellerName}
                          onChange={(e) => setSellerName(e.target.value)}
                          placeholder="Your Company Ltd"
                        />
                      </div>
                      <div>
                        <Label htmlFor="sellerAddress">Address</Label>
                        <Textarea
                          id="sellerAddress"
                          value={sellerAddress}
                          onChange={(e) => setSellerAddress(e.target.value)}
                          placeholder={"123 Business Street\nCity, Country"}
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="sellerEmail">Email</Label>
                        <Input
                          id="sellerEmail"
                          type="email"
                          value={sellerEmail}
                          onChange={(e) => setSellerEmail(e.target.value)}
                          placeholder="billing@company.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Client Info */}
                  <div className="bg-surface-elevated rounded-xl p-6 border border-border">
                    <h3 className="font-semibold text-foreground mb-4">Client Information</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="clientName">Client Name</Label>
                        <Input
                          id="clientName"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="Client Company"
                        />
                      </div>
                      <div>
                        <Label htmlFor="clientAddress">Address</Label>
                        <Textarea
                          id="clientAddress"
                          value={clientAddress}
                          onChange={(e) => setClientAddress(e.target.value)}
                          placeholder={"456 Client Avenue\nCity, Country"}
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="clientEmail">Email</Label>
                        <Input
                          id="clientEmail"
                          type="email"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          placeholder="contact@client.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Invoice Details */}
                  <div className="bg-surface-elevated rounded-xl p-6 border border-border">
                    <h3 className="font-semibold text-foreground mb-4">Invoice Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="invoiceNumber">Invoice Number</Label>
                        <Input id="invoiceNumber" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                      </div>

                      <div>
                        <Label htmlFor="currency">Currency</Label>
                        <Select value={currency} onValueChange={setCurrency}>
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
                        <Label htmlFor="invoiceDate">Invoice Date</Label>
                        <Input id="invoiceDate" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                      </div>

                      <div>
                        <Label htmlFor="dueDate">Due Date</Label>
                        <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                      </div>

                      <div>
                        <Label htmlFor="vatRate">VAT Rate (%)</Label>
                        <Input
                          id="vatRate"
                          type="number"
                          min="0"
                          max="100"
                          value={vatRate}
                          onChange={(e) => setVatRate(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="bg-surface-elevated rounded-xl p-6 border border-border">
                    <h3 className="font-semibold text-foreground mb-4">Line Items</h3>
                    <div className="space-y-3">
                      {lineItems.map((item, index) => (
                        <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-12 sm:col-span-6 lg:col-span-5">
                            {index === 0 && <Label>Description</Label>}
                            <Input
                              value={item.description}
                              onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                              placeholder="Service or product"
                            />
                          </div>

                          <div className="col-span-6 sm:col-span-2">
                            {index === 0 && <Label>Qty</Label>}
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(item.id, "quantity", Number(e.target.value))}
                            />
                          </div>

                          <div className="col-span-6 sm:col-span-3">
                            {index === 0 && <Label>Unit Price</Label>}
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(item.id, "unitPrice", Number(e.target.value))}
                            />
                          </div>

                          <div className="col-span-12 sm:col-span-1 lg:col-span-2 flex justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLineItem(item.id)}
                              disabled={lineItems.length === 1}
                              aria-label="Remove line item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      <Button variant="outline" size="sm" onClick={addLineItem} className="mt-2">
                        <Plus className="h-4 w-4 mr-2" /> Add Line
                      </Button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="bg-surface-elevated rounded-xl p-6 border border-border">
                    <Label htmlFor="notes">Notes / Payment Terms</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Payment due within 30 days..."
                      rows={3}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button onClick={printInvoice} className="flex-1">
                      <Printer className="h-4 w-4 mr-2" /> Print / PDF
                    </Button>
                    <Button variant="outline" onClick={resetInvoice}>
                      <RotateCcw className="h-4 w-4 mr-2" /> Reset
                    </Button>
                  </div>
                </div>

                {/* Preview Panel */}
                <div className="bg-white rounded-xl border border-border p-6 sm:p-8 print:p-0 print:border-none">
                  <div className="space-y-6">
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0">
                        <h2 className="text-2xl font-bold text-foreground break-words">{sellerName || "Your Company"}</h2>
                        <p className="text-muted-foreground whitespace-pre-line text-sm mt-1">{sellerAddress || "Your address"}</p>
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
                              <span className="text-muted-foreground">Due:</span>{" "}
                              <span className="font-medium">{dueDate}</span>
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
                          {lineItems.map((item) => (
                            <tr key={item.id} className="border-t border-border">
                              <td className="p-3 text-sm">{item.description || "—"}</td>
                              <td className="p-3 text-sm text-right">{item.quantity}</td>
                              <td className="p-3 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                              <td className="p-3 text-sm text-right font-medium">{formatCurrency(item.quantity * item.unitPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end">
                      <div className="w-full sm:w-64 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">VAT ({vatRate}%)</span>
                          <span>{formatCurrency(vatAmount)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                          <span>Total</span>
                          <span className="text-primary">{formatCurrency(total)}</span>
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
            </TabsContent>

            {/* ---------------- RECEIPT TAB ---------------- */}
            <TabsContent value="receipt" className="space-y-6">
              <div className="p-6 rounded-xl border border-border bg-surface-elevated">
                
              </div>
            </TabsContent>

            {/* ---------------- CONTRACT TAB ---------------- */}
            <TabsContent value="contract" className="space-y-6">
              <div className="p-6 rounded-xl border border-border bg-surface-elevated">
                
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </ToolLayout>
  );
}
