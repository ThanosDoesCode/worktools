import { useMemo, useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

/** Moat layer (adjust paths if your project differs) */
import { useMoat } from "@/hooks/useMoat";
import { PresetsPanel } from "@/components/moat/PresetsPanel";
import { CopyLinkButton } from "@/components/moat/CopyLinkButton";
import { LocalStatusIndicator } from "@/components/moat/LocalStatusIndicator";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Currency =
  | "USD"
  | "EUR"
  | "GBP"
  | "SEK"
  | "CAD"
  | "MXN"
  | "CHF"
  | "NOK"
  | "DKK"
  | "PLN"
  | "TRY"
  | "JPY"
  | "CNY"
  | "INR"
  | "AUD"
  | "NZD"
  | "SGD"
  | "HKD"
  | "KRW"
  | "THB"
  | "IDR"
  | "BRL"
  | "ZAR"
  | "NGN"
  | "ILS"
  | "AED"
  | "SAR"
  | "BTC"
  | "ETH"
  | "LTC";

type Settings = {
  currency: Currency;
  decimals: number;
  showFormulas: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  currency: "USD",
  decimals: 2,
  showFormulas: true,
};

const CURRENCY_SYMBOL: Record<Currency, string> = {
  // Original
  USD: "$",
  EUR: "€",
  GBP: "£",
  SEK: "kr",

  // North America
  CAD: "$",
  MXN: "$",

  // Europe (Non-Euro)
  CHF: "CHF",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  TRY: "₺",

  // Asia & Pacific
  JPY: "¥",
  CNY: "¥",
  INR: "₹",
  AUD: "$",
  NZD: "$",
  SGD: "$",
  HKD: "$",
  KRW: "₩",
  THB: "฿",
  IDR: "Rp",

  // South America & Africa
  BRL: "R$",
  ZAR: "R",
  NGN: "₦",

  // Middle East
  ILS: "₪",
  AED: "د.إ",
  SAR: "﷼",

  // Cryptocurrencies
  BTC: "₿",
  ETH: "Ξ",
  LTC: "Ł",
};

// Optional: nicer labels in the dropdown
const CURRENCY_LABEL: Record<Currency, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  SEK: "Swedish Krona",
  CAD: "Canadian Dollar",
  MXN: "Mexican Peso",
  CHF: "Swiss Franc",
  NOK: "Norwegian Krone",
  DKK: "Danish Krone",
  PLN: "Polish Złoty",
  TRY: "Turkish Lira",
  JPY: "Japanese Yen",
  CNY: "Chinese Yuan",
  INR: "Indian Rupee",
  AUD: "Australian Dollar",
  NZD: "New Zealand Dollar",
  SGD: "Singapore Dollar",
  HKD: "Hong Kong Dollar",
  KRW: "South Korean Won",
  THB: "Thai Baht",
  IDR: "Indonesian Rupiah",
  BRL: "Brazilian Real",
  ZAR: "South African Rand",
  NGN: "Nigerian Naira",
  ILS: "Israeli Shekel",
  AED: "UAE Dirham",
  SAR: "Saudi Riyal",
  BTC: "Bitcoin",
  ETH: "Ethereum",
  LTC: "Litecoin",
};

const ALL_CURRENCIES: Currency[] = Object.keys(CURRENCY_SYMBOL) as Currency[];

const RECOMMENDED_PRESETS: Array<{ name: string; settings: Settings }> = [
  { name: "Quick (USD) — 2 decimals", settings: { currency: "USD", decimals: 2, showFormulas: false } },
  { name: "Finance (USD) — show formulas", settings: { currency: "USD", decimals: 2, showFormulas: true } },
  { name: "EU (EUR) — 2 decimals", settings: { currency: "EUR", decimals: 2, showFormulas: true } },
  { name: "Rounded — 0 decimals", settings: { currency: "USD", decimals: 0, showFormulas: false } },
  { name: "Sweden (SEK) — 2 decimals", settings: { currency: "SEK", decimals: 2, showFormulas: true } },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function MarginMarkupCalculator() {
  // Inputs (not part of moat — keep moat for settings only)
  const [costPrice, setCostPrice] = useState<string>("100");
  const [sellingPrice, setSellingPrice] = useState<string>("150");

  // Moat settings only
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const toolSlug = "margin-vs-markup-calculator";

  const moat = useMoat(settings as Record<string, unknown>, (s) => setSettings(s as Settings), {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS as Record<string, unknown>,
    recommendedPresets: RECOMMENDED_PRESETS.map((p) => ({ id: p.name, name: p.name, settings: p.settings })),
  });

  const currencySymbol = CURRENCY_SYMBOL[settings.currency];

  const calculations = useMemo(() => {
    const cost = safeNum(costPrice);
    const selling = safeNum(sellingPrice);

    if (cost <= 0 || selling <= 0) {
      return { margin: 0, markup: 0, profit: 0, isValid: false };
    }

    const profit = selling - cost;
    const margin = (profit / selling) * 100;
    const markup = (profit / cost) * 100;

    return { margin, markup, profit, isValid: true };
  }, [costPrice, sellingPrice]);

  const fmtMoney = (n: number) =>
    `${currencySymbol}${n.toLocaleString("en-US", {
      minimumFractionDigits: settings.decimals,
      maximumFractionDigits: settings.decimals,
    })}`;

  const fmtPct = (n: number) =>
    `${n.toLocaleString("en-US", {
      minimumFractionDigits: Math.min(2, settings.decimals),
      maximumFractionDigits: Math.max(2, settings.decimals),
    })}%`;

  const handleReset = () => {
    setCostPrice("100");
    setSellingPrice("150");
    toast.success("Inputs reset");
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    toast.success("Settings reset");
    moat.recordJob();
  };

  const handleCopy = () => {
    const cost = safeNum(costPrice);
    const selling = safeNum(sellingPrice);

    const text = `Margin vs Markup
Cost: ${fmtMoney(cost)}
Selling: ${fmtMoney(selling)}
Profit: ${fmtMoney(calculations.profit)}
Margin: ${fmtPct(calculations.margin)}
Markup: ${fmtPct(calculations.markup)}
Settings: ${settings.currency} • decimals ${settings.decimals} • formulas ${settings.showFormulas ? "on" : "off"}`;

    navigator.clipboard.writeText(text);
    toast.success("Results copied to clipboard");
    moat.recordJob();
  };

  return (
    <ToolLayout
      title="Margin vs Markup Calculator"
      description="Calculate profit margins and markup percentages instantly"
    >
      <div className="grid gap-8 lg:grid-cols-3">
        {/* MOAT COLUMN */}
        <div className="order-3 lg:order-1 space-y-3">
          <LocalStatusIndicator />

          <PresetsPanel
            userPresets={moat.userPresets}
            recommendedPresets={moat.recommendedPresets}
            isLoading={moat.isLoadingPresets}
            onApply={moat.applyPreset}
            onSave={moat.saveCurrentAsPreset}
            onRename={moat.renamePreset}
            onDelete={moat.deletePreset}
            onTogglePinned={moat.togglePinned}
            onUseLastSettings={moat.useLastSettings}
            onReset={moat.resetToDefaults}
          />

          <CopyLinkButton toolSlug={toolSlug} currentSettings={settings} />

          <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground flex gap-2">
            <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <div>
              <b>Moat</b>: save/share calculator settings (currency, decimals, formulas). Your numbers aren’t stored.
            </div>
          </div>
        </div>

        {/* INPUT PANEL */}
        <div className="order-1 lg:order-2 space-y-6">
          <div className="tool-input-panel space-y-6">
            {/* ✅ Currency dropdown (all currencies) */}
            <div className="space-y-2">
              <Label htmlFor="currency" className="text-sm font-medium">
                Currency
              </Label>

              <Select
                value={settings.currency}
                onValueChange={(v) => setSettings((p) => ({ ...p, currency: v as Currency }))}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  {ALL_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CURRENCY_SYMBOL[c]} {c} — {CURRENCY_LABEL[c] ?? c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <p className="text-xs text-muted-foreground">Affects formatting only</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="decimals" className="text-sm font-medium">
                  Decimals
                </Label>
                <Input
                  id="decimals"
                  type="number"
                  min={0}
                  max={6}
                  step={1}
                  value={settings.decimals}
                  onChange={(e) => setSettings((p) => ({ ...p, decimals: clamp(Number(e.target.value || 0), 0, 6) }))}
                />
                <p className="text-xs text-muted-foreground">0–6 decimals</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Show formulas</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={settings.showFormulas ? "default" : "outline"}
                    onClick={() => setSettings((p) => ({ ...p, showFormulas: true }))}
                    className="flex-1"
                  >
                    On
                  </Button>
                  <Button
                    type="button"
                    variant={!settings.showFormulas ? "default" : "outline"}
                    onClick={() => setSettings((p) => ({ ...p, showFormulas: false }))}
                    className="flex-1"
                  >
                    Off
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Explains the math below</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost" className="text-sm font-medium">
                Cost Price
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currencySymbol}</span>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className="pl-8"
                  placeholder="Enter cost price"
                />
              </div>
              <p className="text-xs text-muted-foreground">What you pay for the product or service</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="selling" className="text-sm font-medium">
                Selling Price
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currencySymbol}</span>
                <Input
                  id="selling"
                  type="number"
                  min="0"
                  step="0.01"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="pl-8"
                  placeholder="Enter selling price"
                />
              </div>
              <p className="text-xs text-muted-foreground">What you charge the customer</p>
            </div>

            <div className="flex gap-3 pt-2 flex-wrap">
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset Inputs
              </Button>
              <Button variant="outline" onClick={resetSettings} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset Settings
              </Button>
              <Button onClick={handleCopy} className="gap-2 flex-1 min-w-[180px]">
                <Copy className="h-4 w-4" />
                Copy Results
              </Button>
            </div>
          </div>
        </div>

        {/* OUTPUT PANEL */}
        <div className="order-2 lg:order-3 tool-output-panel space-y-6">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Results</h3>

          {calculations.isValid ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="result-label">Margin</p>
                  <p className="result-highlight text-success">{fmtPct(calculations.margin)}</p>
                </div>
                <div>
                  <p className="result-label">Markup</p>
                  <p className="result-highlight text-info">{fmtPct(calculations.markup)}</p>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <p className="result-label">Profit per Unit</p>
                <p className="result-highlight">{fmtMoney(calculations.profit)}</p>
              </div>

              {/* Visual Comparison */}
              <div className="space-y-3 pt-4">
                <p className="text-sm font-medium text-foreground">Visual Comparison</p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Margin</span>
                    <span className="font-medium text-success">
                      {calculations.margin.toLocaleString("en-US", { maximumFractionDigits: 1 })}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-success transition-all duration-300"
                      style={{ width: `${Math.min(calculations.margin, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Markup</span>
                    <span className="font-medium text-info">
                      {calculations.markup.toLocaleString("en-US", { maximumFractionDigits: 1 })}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-info transition-all duration-300"
                      style={{ width: `${Math.min(calculations.markup, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Explanation */}
              {settings.showFormulas && (
                <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                  <p>
                    <strong>Profit</strong> = Selling − Cost
                  </p>
                  <p className="mt-1">
                    <strong>Margin</strong> = Profit ÷ Selling × 100
                  </p>
                  <p className="mt-1">
                    <strong>Markup</strong> = Profit ÷ Cost × 100
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              Enter valid prices to see results
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}
