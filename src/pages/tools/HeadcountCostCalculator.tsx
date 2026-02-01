import { useMemo, useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, RotateCcw, Users, Calendar, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";

/** Moat layer */
import { useMoat } from "@/hooks/useMoat";
import { PresetsPanel } from "@/components/moat/PresetsPanel";
import { CopyLinkButton } from "@/components/moat/CopyLinkButton";
import { LocalStatusIndicator } from "@/components/moat/LocalStatusIndicator";

const currencies = [
  { code: "EUR", symbol: "€" },
  { code: "USD", symbol: "$" },
  { code: "GBP", symbol: "£" },
  { code: "CHF", symbol: "CHF " },
];

type CurrencyCode = "EUR" | "USD" | "GBP" | "CHF";

type Settings = {
  grossSalary: string;
  employerTaxRate: string;
  benefitsCost: string;
  equipmentCost: string;
  bonuses: string;

  workingHoursPerWeek: string;
  vacationDays: string;
  publicHolidays: string;

  headcount: string;
  currency: CurrencyCode;
};

const DEFAULT_SETTINGS: Settings = {
  grossSalary: "60000",
  employerTaxRate: "25",
  benefitsCost: "3000",
  equipmentCost: "2000",
  bonuses: "5000",

  workingHoursPerWeek: "40",
  vacationDays: "25",
  publicHolidays: "10",

  headcount: "1",
  currency: "EUR",
};

// Presets that make sense without being country-law specific
const RECOMMENDED_PRESETS = [
  {
    name: "Lean hire",
    settings: {
      ...DEFAULT_SETTINGS,
      employerTaxRate: "20",
      benefitsCost: "1000",
      equipmentCost: "1200",
      bonuses: "0",
      vacationDays: "20",
      publicHolidays: "8",
    } satisfies Settings,
  },
  {
    name: "Standard employee",
    settings: {
      ...DEFAULT_SETTINGS,
      employerTaxRate: "25",
      benefitsCost: "3000",
      equipmentCost: "2000",
      bonuses: "5000",
      vacationDays: "25",
      publicHolidays: "10",
    } satisfies Settings,
  },
  {
    name: "Fully-loaded (tech)",
    settings: {
      ...DEFAULT_SETTINGS,
      employerTaxRate: "30",
      benefitsCost: "7000",
      equipmentCost: "3500",
      bonuses: "12000",
      vacationDays: "25",
      publicHolidays: "10",
    } satisfies Settings,
  },
  {
    name: "Contractor-like",
    settings: {
      ...DEFAULT_SETTINGS,
      employerTaxRate: "0",
      benefitsCost: "0",
      equipmentCost: "0",
      bonuses: "0",
      vacationDays: "0",
      publicHolidays: "0",
    } satisfies Settings,
  },
];

export default function HeadcountCostCalculator() {
  const toolSlug = "headcount-cost-calculator";

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const setSettingsForMoat = (s: Record<string, unknown>) => setSettings(s as Settings);

  const moat = useMoat(settings as Record<string, unknown>, setSettingsForMoat, {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS as Record<string, unknown>,
    recommendedPresets: RECOMMENDED_PRESETS.map((p) => ({
      id: p.name,
      name: p.name,
      settings: p.settings as Record<string, unknown>,
    })),
  });

  const currencySymbol = currencies.find((c) => c.code === settings.currency)?.symbol || "€";

  const calculations = useMemo(() => {
    const salary = parseFloat(settings.grossSalary) || 0;
    const taxRate = parseFloat(settings.employerTaxRate) || 0;
    const benefits = parseFloat(settings.benefitsCost) || 0;
    const equipment = parseFloat(settings.equipmentCost) || 0;
    const bonus = parseFloat(settings.bonuses) || 0;

    const hoursPerWeek = Math.max(1, parseFloat(settings.workingHoursPerWeek) || 40);
    const vacation = Math.max(0, parseFloat(settings.vacationDays) || 0);
    const holidays = Math.max(0, parseFloat(settings.publicHolidays) || 0);

    const headcount = Math.max(1, Math.floor(parseFloat(settings.headcount) || 1));

    // Employer taxes
    const employerTaxes = salary * (taxRate / 100);

    // Total annual cost per employee
    const totalAnnualCost = salary + employerTaxes + benefits + equipment + bonus;

    // Monthly cost per employee
    const totalMonthlyCost = totalAnnualCost / 12;

    // Working hours
    const totalWorkDays = 52 * 5; // 260 baseline
    const actualWorkDays = Math.max(0, totalWorkDays - vacation - holidays);
    const actualWorkHours = actualWorkDays * (hoursPerWeek / 5);

    // Cost per hour
    const costPerHour = actualWorkHours > 0 ? totalAnnualCost / actualWorkHours : 0;

    // Team totals
    const teamAnnualCost = totalAnnualCost * headcount;
    const teamMonthlyCost = totalMonthlyCost * headcount;

    // Percent breakdown
    const denom = totalAnnualCost || 1;
    const breakdownPercentages = {
      salary: (salary / denom) * 100,
      taxes: (employerTaxes / denom) * 100,
      benefits: (benefits / denom) * 100,
      equipment: (equipment / denom) * 100,
      bonuses: (bonus / denom) * 100,
    };

    return {
      employerTaxes,
      totalAnnualCost,
      totalMonthlyCost,
      actualWorkDays,
      actualWorkHours,
      costPerHour,
      breakdownPercentages,
      headcount,
      teamAnnualCost,
      teamMonthlyCost,
    };
  }, [settings]);

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((p) => ({ ...p, [key]: value }));
  };

  const handleCopy = async () => {
    const salary = parseFloat(settings.grossSalary) || 0;
    const benefits = parseFloat(settings.benefitsCost) || 0;
    const equipment = parseFloat(settings.equipmentCost) || 0;
    const bonus = parseFloat(settings.bonuses) || 0;

    const text = `Headcount Cost Analysis
Currency: ${settings.currency}

Inputs (per employee):
Gross Salary: ${formatCurrency(salary)}/year
Employer Tax Rate: ${settings.employerTaxRate}%
Benefits: ${formatCurrency(benefits)}/year
Equipment: ${formatCurrency(equipment)}/year
Bonuses: ${formatCurrency(bonus)}/year

Working time:
Hours/week: ${settings.workingHoursPerWeek}
Vacation days: ${settings.vacationDays}
Public holidays: ${settings.publicHolidays}

Results (per employee):
Total Annual Cost: ${formatCurrency(calculations.totalAnnualCost)}
Total Monthly Cost: ${formatCurrency(calculations.totalMonthlyCost)}
Cost per Working Hour: ${formatCurrency(calculations.costPerHour)}
Actual Working Hours/Year: ${calculations.actualWorkHours.toFixed(0)}

Team:
Headcount: ${calculations.headcount}
Team Annual Cost: ${formatCurrency(calculations.teamAnnualCost)}
Team Monthly Cost: ${formatCurrency(calculations.teamMonthlyCost)}`;

    await navigator.clipboard.writeText(text);
    toast.success("Results copied to clipboard");
    moat.recordJob();
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    toast.success("Calculator reset");
    moat.recordJob();
  };

  return (
    <ToolLayout
      title="Headcount Cost Calculator"
      description="Calculate true employee costs including taxes and benefits"
    >
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Moat column */}
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

        {/* Input Panel */}
        <div className="order-1 lg:order-2 lg:col-span-1 space-y-6">
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-4">Team</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="headcount">Headcount</Label>
                <Input
                  id="headcount"
                  type="number"
                  min="1"
                  step="1"
                  value={settings.headcount}
                  onChange={(e) => update("headcount", e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>
          </div>

          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-4">Compensation</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="currency">Currency</Label>
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
                <Label htmlFor="grossSalary">Gross Annual Salary ({currencySymbol})</Label>
                <Input
                  id="grossSalary"
                  type="number"
                  min="0"
                  step="1000"
                  value={settings.grossSalary}
                  onChange={(e) => update("grossSalary", e.target.value)}
                  placeholder="60000"
                />
              </div>

              <div>
                <Label htmlFor="employerTaxRate">Employer Tax Rate (%)</Label>
                <Input
                  id="employerTaxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={settings.employerTaxRate}
                  onChange={(e) => update("employerTaxRate", e.target.value)}
                  placeholder="25"
                />
                <p className="text-xs text-muted-foreground mt-1">Social security, payroll taxes</p>
              </div>

              <div>
                <Label htmlFor="bonuses">Annual Bonuses ({currencySymbol})</Label>
                <Input
                  id="bonuses"
                  type="number"
                  min="0"
                  step="500"
                  value={settings.bonuses}
                  onChange={(e) => update("bonuses", e.target.value)}
                  placeholder="5000"
                />
              </div>
            </div>
          </div>

          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-4">Additional Costs</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="benefitsCost">Annual Benefits Cost ({currencySymbol})</Label>
                <Input
                  id="benefitsCost"
                  type="number"
                  min="0"
                  step="100"
                  value={settings.benefitsCost}
                  onChange={(e) => update("benefitsCost", e.target.value)}
                  placeholder="3000"
                />
                <p className="text-xs text-muted-foreground mt-1">Health insurance, pension, perks</p>
              </div>

              <div>
                <Label htmlFor="equipmentCost">Annual Equipment Cost ({currencySymbol})</Label>
                <Input
                  id="equipmentCost"
                  type="number"
                  min="0"
                  step="100"
                  value={settings.equipmentCost}
                  onChange={(e) => update("equipmentCost", e.target.value)}
                  placeholder="2000"
                />
                <p className="text-xs text-muted-foreground mt-1">Laptop, software, office supplies</p>
              </div>
            </div>
          </div>

          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-4">Working Time</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="workingHoursPerWeek">Hours per Week</Label>
                <Input
                  id="workingHoursPerWeek"
                  type="number"
                  min="1"
                  max="60"
                  value={settings.workingHoursPerWeek}
                  onChange={(e) => update("workingHoursPerWeek", e.target.value)}
                  placeholder="40"
                />
              </div>
              <div>
                <Label htmlFor="vacationDays">Vacation Days</Label>
                <Input
                  id="vacationDays"
                  type="number"
                  min="0"
                  max="60"
                  value={settings.vacationDays}
                  onChange={(e) => update("vacationDays", e.target.value)}
                  placeholder="25"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="publicHolidays">Public Holidays / Year</Label>
                <Input
                  id="publicHolidays"
                  type="number"
                  min="0"
                  max="30"
                  value={settings.publicHolidays}
                  onChange={(e) => update("publicHolidays", e.target.value)}
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground mt-1">Used to estimate actual working hours.</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={handleCopy} className="flex-1">
              <Copy className="h-4 w-4 mr-2" /> Copy Results
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
            </Button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="order-2 lg:order-3 lg:col-span-1 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-primary/10 rounded-xl p-6 border border-primary/20">
              <div className="flex items-center gap-2 text-primary mb-2">
                <Users className="h-5 w-5" />
                <span className="text-sm font-medium">Total Annual Cost (Team)</span>
              </div>
              <p className="text-4xl font-bold text-foreground">{formatCurrency(calculations.teamAnnualCost)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatCurrency(calculations.teamMonthlyCost)}/month • {calculations.headcount} headcount
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Per employee: {formatCurrency(calculations.totalAnnualCost)}/year
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-elevated rounded-xl p-6 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="h-5 w-5" />
                <span className="text-sm font-medium">Cost per Hour</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(calculations.costPerHour)}</p>
            </div>

            <div className="bg-surface-elevated rounded-xl p-6 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calendar className="h-5 w-5" />
                <span className="text-sm font-medium">Working Hours/Year</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{calculations.actualWorkHours.toFixed(0)}</p>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-4">Cost Breakdown (per employee)</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Gross Salary</span>
                  <span className="font-medium">{formatCurrency(parseFloat(settings.grossSalary) || 0)}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${calculations.breakdownPercentages.salary}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Employer Taxes ({settings.employerTaxRate}%)</span>
                  <span className="font-medium">{formatCurrency(calculations.employerTaxes)}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 transition-all duration-300"
                    style={{ width: `${calculations.breakdownPercentages.taxes}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Benefits</span>
                  <span className="font-medium">{formatCurrency(parseFloat(settings.benefitsCost) || 0)}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${calculations.breakdownPercentages.benefits}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Equipment</span>
                  <span className="font-medium">{formatCurrency(parseFloat(settings.equipmentCost) || 0)}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${calculations.breakdownPercentages.equipment}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Bonuses</span>
                  <span className="font-medium">{formatCurrency(parseFloat(settings.bonuses) || 0)}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-300"
                    style={{ width: `${calculations.breakdownPercentages.bonuses}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-4">Summary (per employee)</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Actual work days/year</p>
                <p className="font-semibold text-foreground">{calculations.actualWorkDays}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cost multiplier</p>
                <p className="font-semibold text-foreground">
                  {(calculations.totalAnnualCost / (parseFloat(settings.grossSalary) || 1) || 0).toFixed(2)}x
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Daily cost</p>
                <p className="font-semibold text-foreground">
                  {calculations.actualWorkDays > 0
                    ? formatCurrency(calculations.totalAnnualCost / calculations.actualWorkDays)
                    : formatCurrency(0)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Weekly cost</p>
                <p className="font-semibold text-foreground">{formatCurrency(calculations.totalAnnualCost / 52)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
