import { useEffect, useMemo, useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Copy,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Save,
  FolderOpen,
  Pin,
  Trash2,
  ArrowLeftRight,
} from "lucide-react";
import { toast } from "sonner";

const currencies = [
  { code: "EUR", symbol: "€" },
  { code: "USD", symbol: "$" },
  { code: "GBP", symbol: "£" },
  { code: "CHF", symbol: "CHF" },
];

type Scenario = {
  id: string;
  name: string;
  pinned?: boolean;
  updatedAt: number;
  data: {
    openingBalance: string;
    monthlyIncome: string;
    fixedCosts: string;
    variableCosts: string;
    currency: string;
    targetRunwayMonths: string; // new
    cashFloor: string; // new
  };
};

const STORAGE_KEY = "tool.cashflow.scenarios.v1";
const ACTIVE_KEY = "tool.cashflow.activeScenarioId.v1";
const COMPARE_KEY = "tool.cashflow.compareScenarioId.v1";

function uid() {
  return Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function CashFlowForecast() {
  // ---- Core inputs (current working state)
  const [openingBalance, setOpeningBalance] = useState<string>("50000");
  const [monthlyIncome, setMonthlyIncome] = useState<string>("25000");
  const [fixedCosts, setFixedCosts] = useState<string>("15000");
  const [variableCosts, setVariableCosts] = useState<string>("8000");
  const [currency, setCurrency] = useState("EUR");

  // ---- New: targets
  const [targetRunwayMonths, setTargetRunwayMonths] = useState<string>("6");
  const [cashFloor, setCashFloor] = useState<string>("10000");

  const currencySymbol = currencies.find((c) => c.code === currency)?.symbol || "€";

  // ---- Scenarios (moat)
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string>("");
  const [compareScenarioId, setCompareScenarioId] = useState<string>("");

  // Load from storage once
  useEffect(() => {
    const stored = safeParse<Scenario[]>(localStorage.getItem(STORAGE_KEY), []);
    const storedActive = localStorage.getItem(ACTIVE_KEY) || "";
    const storedCompare = localStorage.getItem(COMPARE_KEY) || "";

    setScenarios(stored);

    // If no scenarios exist, create a default
    if (stored.length === 0) {
      const id = uid();
      const base: Scenario = {
        id,
        name: "Base case",
        pinned: true,
        updatedAt: Date.now(),
        data: {
          openingBalance: "50000",
          monthlyIncome: "25000",
          fixedCosts: "15000",
          variableCosts: "8000",
          currency: "EUR",
          targetRunwayMonths: "6",
          cashFloor: "10000",
        },
      };
      setScenarios([base]);
      setActiveScenarioId(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([base]));
      localStorage.setItem(ACTIVE_KEY, id);
      return;
    }

    // Set active scenario
    const defaultActive = storedActive && stored.some((s) => s.id === storedActive) ? storedActive : stored[0].id;
    setActiveScenarioId(defaultActive);
    localStorage.setItem(ACTIVE_KEY, defaultActive);

    // Set compare scenario (optional)
    if (storedCompare && stored.some((s) => s.id === storedCompare)) {
      setCompareScenarioId(storedCompare);
    }
  }, []);

  // Persist scenarios when they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  }, [scenarios]);

  useEffect(() => {
    if (activeScenarioId) localStorage.setItem(ACTIVE_KEY, activeScenarioId);
  }, [activeScenarioId]);

  useEffect(() => {
    if (compareScenarioId) localStorage.setItem(COMPARE_KEY, compareScenarioId);
    else localStorage.removeItem(COMPARE_KEY);
  }, [compareScenarioId]);

  // Apply active scenario to inputs when active changes
  useEffect(() => {
    const s = scenarios.find((x) => x.id === activeScenarioId);
    if (!s) return;
    setOpeningBalance(s.data.openingBalance);
    setMonthlyIncome(s.data.monthlyIncome);
    setFixedCosts(s.data.fixedCosts);
    setVariableCosts(s.data.variableCosts);
    setCurrency(s.data.currency);
    setTargetRunwayMonths(s.data.targetRunwayMonths);
    setCashFloor(s.data.cashFloor);
  }, [activeScenarioId, scenarios]);

  // Auto-save edits back to active scenario (sticky)
  useEffect(() => {
    const s = scenarios.find((x) => x.id === activeScenarioId);
    if (!s) return;

    const next: Scenario = {
      ...s,
      updatedAt: Date.now(),
      data: {
        openingBalance,
        monthlyIncome,
        fixedCosts,
        variableCosts,
        currency,
        targetRunwayMonths,
        cashFloor,
      },
    };

    setScenarios((prev) => prev.map((p) => (p.id === activeScenarioId ? next : p)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingBalance, monthlyIncome, fixedCosts, variableCosts, currency, targetRunwayMonths, cashFloor]);

  const calculations = useMemo(() => {
    const opening = parseFloat(openingBalance) || 0;
    const income = parseFloat(monthlyIncome) || 0;
    const fixed = parseFloat(fixedCosts) || 0;
    const variable = parseFloat(variableCosts) || 0;

    const totalExpenses = fixed + variable;
    const netCashFlow = income - totalExpenses;

    let runway = 0;
    if (netCashFlow < 0) {
      runway = Math.floor(opening / Math.abs(netCashFlow));
    } else if (netCashFlow === 0) {
      runway = opening > 0 ? Infinity : 0;
    } else {
      runway = Infinity;
    }

    const projection: { month: number; balance: number; income: number; expenses: number; netFlow: number }[] = [];
    let runningBalance = opening;
    for (let month = 0; month <= 12; month++) {
      projection.push({
        month,
        balance: runningBalance,
        income: month === 0 ? 0 : income,
        expenses: month === 0 ? 0 : totalExpenses,
        netFlow: month === 0 ? 0 : netCashFlow,
      });
      runningBalance += netCashFlow;
    }

    const isHealthy = netCashFlow >= 0;
    const isWarning = netCashFlow < 0 && runway > 3;
    const isCritical = netCashFlow < 0 && runway <= 3;

    // New: cash floor & target runway checks
    const floor = parseFloat(cashFloor) || 0;
    const floorBreach = projection.find((p) => p.month > 0 && p.balance < floor);
    const target = parseInt(targetRunwayMonths || "0", 10) || 0;
    const meetsTargetRunway = runway === Infinity ? true : runway >= target;

    // New: quick levers to hit target (very useful)
    // If burning: how much extra income or cost reduction needed to meet target runway months
    let neededIncomeDelta = 0;
    let neededCostReduction = 0;
    if (target > 0 && netCashFlow < 0) {
      // need opening / abs(net) >= target  => abs(net) <= opening/target
      const maxBurn = opening / target; // allowed burn per month
      const currentBurn = Math.abs(netCashFlow);
      const burnReductionNeeded = Math.max(0, currentBurn - maxBurn);
      // Burn reduction can come from +income or -expenses
      neededIncomeDelta = burnReductionNeeded;
      neededCostReduction = burnReductionNeeded;
    }

    return {
      netCashFlow,
      totalExpenses,
      runway,
      projection,
      isHealthy,
      isWarning,
      isCritical,
      floorBreach,
      floor,
      target,
      meetsTargetRunway,
      neededIncomeDelta,
      neededCostReduction,
      endBalance12: projection[12]?.balance ?? 0,
    };
  }, [openingBalance, monthlyIncome, fixedCosts, variableCosts, cashFloor, targetRunwayMonths]);

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId);

  // Compare scenario calc (same logic, isolated)
  const compareCalculations = useMemo(() => {
    if (!compareScenarioId) return null;
    const s = scenarios.find((x) => x.id === compareScenarioId);
    if (!s) return null;

    const opening = parseFloat(s.data.openingBalance) || 0;
    const income = parseFloat(s.data.monthlyIncome) || 0;
    const fixed = parseFloat(s.data.fixedCosts) || 0;
    const variable = parseFloat(s.data.variableCosts) || 0;

    const totalExpenses = fixed + variable;
    const netCashFlow = income - totalExpenses;

    let runway = 0;
    if (netCashFlow < 0) runway = Math.floor(opening / Math.abs(netCashFlow));
    else if (netCashFlow === 0) runway = opening > 0 ? Infinity : 0;
    else runway = Infinity;

    let runningBalance = opening;
    for (let month = 1; month <= 12; month++) runningBalance += netCashFlow;

    return {
      id: s.id,
      name: s.name,
      currency: s.data.currency,
      netCashFlow,
      runway,
      endBalance12: runningBalance,
    };
  }, [compareScenarioId, scenarios]);

  const handleCopy = () => {
    const scenarioName = activeScenario?.name || "Scenario";
    const floorText =
      calculations.floor > 0
        ? `Cash Floor: ${formatCurrency(calculations.floor)}${calculations.floorBreach ? ` (breach at Month ${calculations.floorBreach.month})` : " (not breached)"}`
        : "Cash Floor: —";

    const runwayText = calculations.runway === Infinity ? "Unlimited (growing cash)" : `${calculations.runway} months`;

    const targetText =
      calculations.target > 0
        ? `Target Runway: ${calculations.target} months (${calculations.meetsTargetRunway ? "met" : "not met"})`
        : "Target Runway: —";

    const leverText =
      !calculations.meetsTargetRunway && calculations.netCashFlow < 0 && calculations.target > 0
        ? `To hit target runway, reduce monthly burn by ~${formatCurrency(Math.ceil(calculations.neededCostReduction))} (either +income or -costs).`
        : "";

    const compareText = compareCalculations
      ? `\n\nCompare vs "${compareCalculations.name}":\n• Net Cash Flow: ${formatCurrency(calculations.netCashFlow - compareCalculations.netCashFlow)} delta\n• End Balance (12m): ${formatCurrency(calculations.endBalance12 - compareCalculations.endBalance12)} delta\n• Runway: ${
          calculations.runway === Infinity || compareCalculations.runway === Infinity
            ? "—"
            : `${calculations.runway - compareCalculations.runway} months delta`
        }`
      : "";

    const text = `${scenarioName} — Cash Flow Forecast
Currency: ${currencySymbol} (${currency})

Inputs:
Opening Balance: ${formatCurrency(parseFloat(openingBalance) || 0)}
Monthly Income: ${formatCurrency(parseFloat(monthlyIncome) || 0)}
Fixed Costs: ${formatCurrency(parseFloat(fixedCosts) || 0)}
Variable Costs: ${formatCurrency(parseFloat(variableCosts) || 0)}

Results:
Net Monthly Cash Flow: ${formatCurrency(calculations.netCashFlow)}
Runway: ${runwayText}
${targetText}
${floorText}
${leverText}${compareText}

12-Month Balances:
${calculations.projection.map((p) => `Month ${p.month}: ${formatCurrency(p.balance)}`).join("\n")}`;

    navigator.clipboard.writeText(text);
    toast.success("Results copied to clipboard");
  };

  const handleReset = () => {
    setOpeningBalance("50000");
    setMonthlyIncome("25000");
    setFixedCosts("15000");
    setVariableCosts("8000");
    setCurrency("EUR");
    setTargetRunwayMonths("6");
    setCashFloor("10000");
    toast.success("Calculator reset");
  };

  // Scenario actions
  const handleSaveAsNew = () => {
    const name = prompt("Scenario name?", activeScenario?.name ? `${activeScenario.name} (copy)` : "New scenario");
    if (!name) return;

    const next: Scenario = {
      id: uid(),
      name,
      pinned: false,
      updatedAt: Date.now(),
      data: { openingBalance, monthlyIncome, fixedCosts, variableCosts, currency, targetRunwayMonths, cashFloor },
    };

    setScenarios((prev) => [next, ...prev]);
    setActiveScenarioId(next.id);
    toast.success("Scenario saved");
  };

  const handleRename = () => {
    if (!activeScenario) return;
    const name = prompt("Rename scenario", activeScenario.name);
    if (!name) return;

    setScenarios((prev) => prev.map((s) => (s.id === activeScenario.id ? { ...s, name, updatedAt: Date.now() } : s)));
    toast.success("Scenario renamed");
  };

  const handleTogglePin = () => {
    if (!activeScenario) return;
    setScenarios((prev) =>
      prev.map((s) => (s.id === activeScenario.id ? { ...s, pinned: !s.pinned, updatedAt: Date.now() } : s)),
    );
  };

  const handleDelete = () => {
    if (!activeScenario) return;
    if (scenarios.length <= 1) {
      toast.error("You need at least 1 scenario");
      return;
    }
    const ok = confirm(`Delete "${activeScenario.name}"?`);
    if (!ok) return;

    const remaining = scenarios.filter((s) => s.id !== activeScenario.id);
    setScenarios(remaining);
    setActiveScenarioId(remaining[0].id);
    if (compareScenarioId === activeScenario.id) setCompareScenarioId("");
    toast.success("Scenario deleted");
  };

  const orderedScenarios = useMemo(() => {
    return [...scenarios].sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (bp !== ap) return bp - ap;
      return b.updatedAt - a.updatedAt;
    });
  }, [scenarios]);

  const maxBalance = Math.max(...calculations.projection.map((p) => Math.abs(p.balance)));
  const minBalance = Math.min(...calculations.projection.map((p) => p.balance));

  return (
    <ToolLayout title="Cash Flow Forecast" description="Project your business cash flow, runway, and scenario options">
      {/* Scenario Bar (mobile-first, moat) */}
      <div className="mb-6 bg-surface-elevated rounded-xl p-4 border border-border">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="min-w-[220px]">
              <Label>Scenario</Label>
              <Select value={activeScenarioId} onValueChange={setActiveScenarioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a scenario" />
                </SelectTrigger>
                <SelectContent>
                  {orderedScenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.pinned ? "📌 " : ""}
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[220px]">
              <Label className="flex items-center gap-2">
                Compare <ArrowLeftRight className="h-4 w-4" />
              </Label>
              <Select value={compareScenarioId} onValueChange={setCompareScenarioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {orderedScenarios
                    .filter((s) => s.id !== activeScenarioId)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.pinned ? "📌 " : ""}
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleRename} disabled={!activeScenario}>
              <FolderOpen className="h-4 w-4 mr-2" /> Rename
            </Button>
            <Button variant="outline" onClick={handleTogglePin} disabled={!activeScenario}>
              <Pin className="h-4 w-4 mr-2" /> Pin
            </Button>
            <Button onClick={handleSaveAsNew}>
              <Save className="h-4 w-4 mr-2" /> Save as new
            </Button>
            <Button variant="outline" onClick={handleDelete} disabled={!activeScenario}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          </div>
        </div>

        {compareCalculations && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg p-3 bg-muted/40 border border-border">
              <p className="text-xs text-muted-foreground">Δ Net Cash Flow vs {compareCalculations.name}</p>
              <p className="font-semibold">
                {formatCurrency(calculations.netCashFlow - compareCalculations.netCashFlow)}
              </p>
            </div>
            <div className="rounded-lg p-3 bg-muted/40 border border-border">
              <p className="text-xs text-muted-foreground">Δ End Balance (12m)</p>
              <p className="font-semibold">
                {formatCurrency(calculations.endBalance12 - compareCalculations.endBalance12)}
              </p>
            </div>
            <div className="rounded-lg p-3 bg-muted/40 border border-border">
              <p className="text-xs text-muted-foreground">Δ Runway</p>
              <p className="font-semibold">
                {calculations.runway === Infinity || compareCalculations.runway === Infinity
                  ? "—"
                  : `${calculations.runway - compareCalculations.runway} months`}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Input Panel */}
        <div className="space-y-6">
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <div className="space-y-4">
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
                <Label htmlFor="openingBalance">Opening Cash Balance ({currencySymbol})</Label>
                <Input
                  id="openingBalance"
                  type="number"
                  min="0"
                  step="1000"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">Current cash in bank</p>
              </div>

              <div>
                <Label htmlFor="monthlyIncome">Monthly Income ({currencySymbol})</Label>
                <Input
                  id="monthlyIncome"
                  type="number"
                  min="0"
                  step="1000"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">Expected monthly revenue</p>
              </div>

              <div>
                <Label htmlFor="fixedCosts">Monthly Fixed Costs ({currencySymbol})</Label>
                <Input
                  id="fixedCosts"
                  type="number"
                  min="0"
                  step="100"
                  value={fixedCosts}
                  onChange={(e) => setFixedCosts(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">Rent, salaries, subscriptions</p>
              </div>

              <div>
                <Label htmlFor="variableCosts">Monthly Variable Costs ({currencySymbol})</Label>
                <Input
                  id="variableCosts"
                  type="number"
                  min="0"
                  step="100"
                  value={variableCosts}
                  onChange={(e) => setVariableCosts(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">COGS, marketing, supplies</p>
              </div>

              {/* New: Targets */}
              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <Label htmlFor="targetRunway">Target runway (months)</Label>
                  <Input
                    id="targetRunway"
                    type="number"
                    min="0"
                    step="1"
                    value={targetRunwayMonths}
                    onChange={(e) => setTargetRunwayMonths(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Example: 6 or 12</p>
                </div>
                <div>
                  <Label htmlFor="cashFloor">Minimum cash floor ({currencySymbol})</Label>
                  <Input
                    id="cashFloor"
                    type="number"
                    min="0"
                    step="1000"
                    value={cashFloor}
                    onChange={(e) => setCashFloor(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Alert if balance goes below</p>
                </div>
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
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div
              className={`rounded-xl p-6 border ${
                calculations.isHealthy
                  ? "bg-green-500/10 border-green-500/20"
                  : "bg-destructive/10 border-destructive/20"
              }`}
            >
              <div
                className={`flex items-center gap-2 mb-2 ${calculations.isHealthy ? "text-green-600" : "text-destructive"}`}
              >
                {calculations.isHealthy ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                <span className="text-sm font-medium">Net Cash Flow</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{formatCurrency(calculations.netCashFlow)}</p>
              <p className="text-sm text-muted-foreground mt-1">per month</p>
            </div>

            <div
              className={`rounded-xl p-6 border ${
                calculations.isCritical
                  ? "bg-destructive/10 border-destructive/20"
                  : calculations.isWarning
                    ? "bg-yellow-500/10 border-yellow-500/20"
                    : "bg-green-500/10 border-green-500/20"
              }`}
            >
              <div
                className={`flex items-center gap-2 mb-2 ${
                  calculations.isCritical
                    ? "text-destructive"
                    : calculations.isWarning
                      ? "text-yellow-600"
                      : "text-green-600"
                }`}
              >
                {calculations.isCritical ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                <span className="text-sm font-medium">Business Runway</span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {calculations.runway === Infinity ? "∞" : calculations.runway}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {calculations.runway === Infinity ? "Growing cash" : "months remaining"}
              </p>
            </div>
          </div>

          {/* New: Target + Floor Insights */}
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-3">Insights</h3>

            <div className="space-y-2 text-sm">
              {calculations.target > 0 && (
                <p className={calculations.meetsTargetRunway ? "text-green-600" : "text-destructive"}>
                  {calculations.meetsTargetRunway ? "✅" : "⚠️"} Target runway: {calculations.target} months{" "}
                  {calculations.meetsTargetRunway ? "met" : "not met"}
                </p>
              )}

              {calculations.floor > 0 && (
                <p className={calculations.floorBreach ? "text-destructive" : "text-green-600"}>
                  {calculations.floorBreach ? "⚠️" : "✅"} Cash floor: {formatCurrency(calculations.floor)}{" "}
                  {calculations.floorBreach ? `breached at Month ${calculations.floorBreach.month}` : "not breached"}
                </p>
              )}

              {!calculations.meetsTargetRunway && calculations.netCashFlow < 0 && calculations.target > 0 && (
                <div className="mt-3 rounded-lg p-3 bg-yellow-500/10 border border-yellow-500/20">
                  <p className="font-medium">To hit your target runway</p>
                  <p className="text-muted-foreground">
                    Reduce monthly burn by about{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(Math.ceil(calculations.neededCostReduction))}
                    </span>{" "}
                    (either +income or -costs).
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Status Warning */}
          {calculations.isCritical && (
            <div className="bg-destructive/10 rounded-xl p-4 border border-destructive/20 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Critical: Low Runway</p>
                <p className="text-sm text-muted-foreground mt-1">
                  At current burn rate, you have only {calculations.runway} months of cash remaining. Consider reducing
                  costs or increasing revenue immediately.
                </p>
              </div>
            </div>
          )}

          {/* Monthly Breakdown */}
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-4">Monthly Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-green-600">
                <span>Income</span>
                <span className="font-medium">+{formatCurrency(parseFloat(monthlyIncome) || 0)}</span>
              </div>
              <div className="flex justify-between items-center text-destructive">
                <span>Fixed Costs</span>
                <span className="font-medium">-{formatCurrency(parseFloat(fixedCosts) || 0)}</span>
              </div>
              <div className="flex justify-between items-center text-destructive">
                <span>Variable Costs</span>
                <span className="font-medium">-{formatCurrency(parseFloat(variableCosts) || 0)}</span>
              </div>
              <div className="h-px bg-border" />
              <div
                className={`flex justify-between items-center font-semibold ${calculations.netCashFlow >= 0 ? "text-green-600" : "text-destructive"}`}
              >
                <span>Net Cash Flow</span>
                <span>
                  {calculations.netCashFlow >= 0 ? "+" : ""}
                  {formatCurrency(calculations.netCashFlow)}
                </span>
              </div>
            </div>
          </div>

          {/* 12 Month Chart */}
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-4">12-Month Projection</h3>
            <div className="relative h-48">
              {minBalance < 0 && (
                <div
                  className="absolute left-8 right-0 border-t border-destructive/50 border-dashed"
                  style={{
                    bottom: `${(Math.abs(minBalance) / (maxBalance - minBalance)) * 100}%`,
                  }}
                />
              )}

              <div className="absolute inset-0 flex items-end justify-between gap-1 pl-8">
                {calculations.projection.map((point, index) => {
                  const height = maxBalance > 0 ? (Math.abs(point.balance) / maxBalance) * 100 : 0;
                  const isNegative = point.balance < 0;

                  return (
                    <div
                      key={index}
                      className="flex-1 flex flex-col justify-end items-center"
                      style={{ height: "100%" }}
                    >
                      <div
                        className={`w-full rounded-t transition-all duration-300 ${isNegative ? "bg-destructive" : "bg-primary"}`}
                        style={{ height: `${Math.min(height, 100)}%` }}
                        title={`Month ${point.month}: ${formatCurrency(point.balance)}`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-xs text-muted-foreground">
                <span>{formatCurrency(maxBalance)}</span>
                <span>{formatCurrency(maxBalance / 2)}</span>
                <span>{currencySymbol}0</span>
              </div>
            </div>

            <div className="flex justify-between mt-2 pl-8 text-xs text-muted-foreground">
              <span>Now</span>
              <span>6m</span>
              <span>12m</span>
            </div>
          </div>

          {/* Projection Table */}
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-4">Monthly Balances</h3>
            <div className="grid grid-cols-4 gap-2 text-sm">
              {calculations.projection.slice(0, 12).map((point) => (
                <div
                  key={point.month}
                  className={`p-2 rounded text-center ${point.balance < 0 ? "bg-destructive/10 text-destructive" : "bg-muted/50"}`}
                >
                  <p className="text-xs text-muted-foreground">M{point.month}</p>
                  <p className="font-medium">{formatCurrency(point.balance)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
