import { useMemo, useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy, RotateCcw, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

/** Moat layer (adjust import paths to your project if needed) */
import { useMoat } from "@/hooks/useMoat";
import { PresetsPanel } from "@/components/moat/PresetsPanel";
import { CopyLinkButton } from "@/components/moat/CopyLinkButton";
import { LocalStatusIndicator } from "@/components/moat/LocalStatusIndicator";

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
type TimeMode = "minutes" | "hours";
type WorkdaysMode = "simple" | "workdays";

type Settings = {
  currency: Currency;

  // Formatting
  decimals: number;

  // Assumptions
  publicHolidaysPerYear: number; // used in workdays mode
  meetingDaysPerWeek: number; // 1..5 for weekly cadence
  showFormulas: boolean;

  // Optional extra: include overhead multipliers (facilitator prep, context switch)
  overheadPct: number; // 0..200
  includeOverhead: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  currency: "USD",
  decimals: 0,
  publicHolidaysPerYear: 10,
  meetingDaysPerWeek: 1,
  showFormulas: true,
  overheadPct: 15,
  includeOverhead: false,
};

const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  SEK: "kr",
  CAD: "C$",
  MXN: "$",
  CHF: "CHF",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  TRY: "₺",
  JPY: "¥",
  CNY: "¥",
  INR: "₹",
  AUD: "A$",
  NZD: "NZ$",
  SGD: "S$",
  HKD: "HK$",
  KRW: "₩",
  THB: "฿",
  IDR: "Rp",
  BRL: "R$",
  ZAR: "R",
  NGN: "₦",
  ILS: "₪",
  AED: "د.إ",
  SAR: "﷼",
  BTC: "₿",
  ETH: "Ξ",
  LTC: "Ł",
};

const RECOMMENDED_PRESETS: Array<{ name: string; settings: Settings }> = [
  {
    name: "Quick (USD) — rounded",
    settings: { ...DEFAULT_SETTINGS, currency: "USD", decimals: 0, showFormulas: false },
  },
  {
    name: "EU (EUR) — show formulas",
    settings: { ...DEFAULT_SETTINGS, currency: "EUR", decimals: 0, showFormulas: true },
  },
  {
    name: "Sweden (SEK) — rounded",
    settings: { ...DEFAULT_SETTINGS, currency: "SEK", decimals: 0, showFormulas: true },
  },
  { name: "Include overhead (15%)", settings: { ...DEFAULT_SETTINGS, includeOverhead: true, overheadPct: 15 } },
  { name: "Workdays model", settings: { ...DEFAULT_SETTINGS, showFormulas: true, publicHolidaysPerYear: 10 } },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function MeetingCostCalculator() {
  // Inputs (kept local; moat focuses on *settings* for share/save)
  const [participants, setParticipants] = useState<string>("5");
  const [hourlySalary, setHourlySalary] = useState<string>("50");
  const [duration, setDuration] = useState<string>("60");
  const [frequency, setFrequency] = useState<string>("4"); // times per month

  // Moat settings
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const toolSlug = "meeting-cost-calculator";

  const moat = useMoat(settings as Record<string, unknown>, (s) => setSettings(s as Settings), {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS as Record<string, unknown>,
    recommendedPresets: RECOMMENDED_PRESETS.map((p) => ({ id: p.name, name: p.name, settings: p.settings })),
  });

  const currencySymbol = CURRENCY_SYMBOL[settings.currency];

  const calculations = useMemo(() => {
    const p = safeNum(participants);
    const salary = safeNum(hourlySalary);
    const durMin = safeNum(duration);
    const freq = safeNum(frequency);

    if (p <= 0 || salary <= 0 || durMin <= 0) {
      return {
        meetingCost: 0,
        costPerMinute: 0,
        monthlyCost: 0,
        annualCost: 0,
        overheadCost: 0,
        totalWithOverhead: 0,
        isValid: false,
      };
    }

    const hoursInMeeting = durMin / 60;
    const baseMeetingCost = p * salary * hoursInMeeting;

    const overheadCost = settings.includeOverhead ? baseMeetingCost * (settings.overheadPct / 100) : 0;
    const meetingCost = baseMeetingCost;
    const totalMeetingCost = baseMeetingCost + overheadCost;

    const costPerMinute = totalMeetingCost / durMin;
    const monthlyCost = totalMeetingCost * Math.max(0, freq);
    const annualCost = monthlyCost * 12;

    return {
      meetingCost,
      costPerMinute,
      monthlyCost,
      annualCost,
      overheadCost,
      totalWithOverhead: totalMeetingCost,
      isValid: true,
    };
  }, [participants, hourlySalary, duration, frequency, settings.includeOverhead, settings.overheadPct]);

  const fmtCurrency = (value: number) =>
    `${currencySymbol}${value.toLocaleString("en-US", {
      minimumFractionDigits: settings.decimals,
      maximumFractionDigits: settings.decimals,
    })}`;

  const handleResetInputs = () => {
    setParticipants("5");
    setHourlySalary("50");
    setDuration("60");
    setFrequency("4");
    toast.success("Inputs reset");
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    toast.success("Settings reset");
    moat.recordJob();
  };

  const handleCopy = () => {
    const p = safeNum(participants);
    const salary = safeNum(hourlySalary);
    const durMin = safeNum(duration);
    const freq = safeNum(frequency);

    const lines = [
      "Meeting Cost (estimate)",
      `Participants: ${p}`,
      `Avg hourly rate: ${fmtCurrency(salary)}/hour`,
      `Duration: ${durMin} min`,
      `Meetings/month: ${freq}`,
      "",
      `This meeting: ${fmtCurrency(calculations.totalWithOverhead)}${settings.includeOverhead ? " (incl. overhead)" : ""}`,
      `Cost per minute: ${fmtCurrency(calculations.costPerMinute)}/min`,
      `Monthly cost: ${fmtCurrency(calculations.monthlyCost)}`,
      `Annual cost: ${fmtCurrency(calculations.annualCost)}`,
      "",
      `Settings: ${settings.currency} • decimals ${settings.decimals} • overhead ${settings.includeOverhead ? `${settings.overheadPct}%` : "off"}`,
    ].join("\n");

    navigator.clipboard.writeText(lines);
    toast.success("Results copied to clipboard");
    moat.recordJob();
  };

  const formatCurrencyCompact = (value: number) => {
    // keep UI compact for big numbers
    return `${currencySymbol}${value.toLocaleString("en-US", {
      notation: value >= 100000 ? "compact" : "standard",
      compactDisplay: "short",
      maximumFractionDigits: value >= 100000 ? 1 : settings.decimals,
      minimumFractionDigits: value >= 100000 ? 0 : settings.decimals,
    })}`;
  };

  const annualIsHigh = calculations.annualCost > 50000;

  return (
    <ToolLayout title="Meeting Cost Calculator" description="Calculate how much your meetings really cost">
      {/* 3-column layout: moat | inputs | results */}
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
        </div>

        {/* INPUT PANEL */}
        <div className="order-1 lg:order-2 tool-input-panel space-y-6">
          {/* Currency + formatting */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Currency</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["USD", "EUR", "GBP", "SEK"] as Currency[]).map((c) => (
                <Button
                  key={c}
                  type="button"
                  variant={settings.currency === c ? "default" : "outline"}
                  onClick={() => setSettings((p) => ({ ...p, currency: c }))}
                >
                  {CURRENCY_SYMBOL[c]} {c}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Formatting only</p>
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
                max={2}
                step={1}
                value={settings.decimals}
                onChange={(e) => setSettings((p) => ({ ...p, decimals: clamp(Number(e.target.value || 0), 0, 2) }))}
              />
              <p className="text-xs text-muted-foreground">0–2 (keeps it readable)</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Include overhead</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={settings.includeOverhead ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSettings((p) => ({ ...p, includeOverhead: true }))}
                >
                  On
                </Button>
                <Button
                  type="button"
                  variant={!settings.includeOverhead ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSettings((p) => ({ ...p, includeOverhead: false }))}
                >
                  Off
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Prep/context-switch estimate</p>
            </div>
          </div>

          {settings.includeOverhead && (
            <div className="space-y-2">
              <Label htmlFor="overhead" className="text-sm font-medium">
                Overhead (%)
              </Label>
              <Input
                id="overhead"
                type="number"
                min={0}
                max={200}
                step={1}
                value={settings.overheadPct}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, overheadPct: clamp(Number(e.target.value || 0), 0, 200) }))
                }
              />
              <p className="text-xs text-muted-foreground">Common range: 10–30%</p>
            </div>
          )}

          {/* Meeting inputs */}
          <div className="space-y-2">
            <Label htmlFor="participants" className="text-sm font-medium">
              Number of Participants
            </Label>
            <Input
              id="participants"
              type="number"
              min="1"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="e.g., 5"
            />
            <p className="text-xs text-muted-foreground">Everyone attending the meeting</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="salary" className="text-sm font-medium">
              Average Hourly Salary
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currencySymbol}</span>
              <Input
                id="salary"
                type="number"
                min="0"
                step="1"
                value={hourlySalary}
                onChange={(e) => setHourlySalary(e.target.value)}
                className="pl-8"
                placeholder="e.g., 50"
              />
            </div>
            <p className="text-xs text-muted-foreground">Average hourly rate of attendees</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration" className="text-sm font-medium">
              Meeting Duration (minutes)
            </Label>
            <Input
              id="duration"
              type="number"
              min="1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g., 60"
            />
            <p className="text-xs text-muted-foreground">Length of the meeting in minutes</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency" className="text-sm font-medium">
              Meetings per Month
            </Label>
            <Input
              id="frequency"
              type="number"
              min="0"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="e.g., 4"
            />
            <p className="text-xs text-muted-foreground">How often this meeting recurs monthly</p>
          </div>

          <div className="flex gap-3 pt-2 flex-wrap">
            <Button variant="outline" onClick={handleResetInputs} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset Inputs
            </Button>
            <Button variant="outline" onClick={handleResetSettings} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset Settings
            </Button>
            <Button onClick={handleCopy} className="gap-2 flex-1 min-w-[160px]">
              <Copy className="h-4 w-4" />
              Copy Results
            </Button>
          </div>
        </div>

        {/* OUTPUT PANEL */}
        <div className="order-2 lg:order-3 tool-output-panel space-y-6">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Meeting Costs</h3>

          {calculations.isValid ? (
            <div className="space-y-6">
              <div className="p-6 rounded-lg bg-muted/50 text-center">
                <p className="result-label">This Meeting Costs</p>
                <p className="text-4xl font-bold text-foreground mt-2">
                  {formatCurrencyCompact(calculations.totalWithOverhead)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatCurrencyCompact(calculations.costPerMinute)}/minute
                  {settings.includeOverhead && calculations.overheadCost > 0 && (
                    <>
                      {" "}
                      • overhead:{" "}
                      <span className="font-medium text-foreground">
                        {formatCurrencyCompact(calculations.overheadCost)}
                      </span>
                    </>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-border">
                  <p className="result-label">Monthly Cost</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {formatCurrencyCompact(calculations.monthlyCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">{frequency}× per month</p>
                </div>
                <div className="p-4 rounded-lg border border-border">
                  <p className="result-label">Annual Cost</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {formatCurrencyCompact(calculations.annualCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">12 months</p>
                </div>
              </div>

              {annualIsHigh && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-warning-light">
                  <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">High Meeting Cost</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Try: fewer attendees, shorter duration, tighter agenda, or async update (doc/email).
                    </p>
                  </div>
                </div>
              )}

              {settings.showFormulas && (
                <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                  <p>
                    <strong>Formula:</strong>
                  </p>
                  <p className="mt-1">Base = Participants × Hourly Rate × (Duration ÷ 60)</p>
                  {settings.includeOverhead && <p className="mt-1">Total = Base × (1 + Overhead%)</p>}
                  <p className="mt-1">Monthly = Total × Meetings/Month</p>
                  <p className="mt-1">Annual = Monthly × 12</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              Enter valid values to see results
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}
