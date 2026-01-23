import { useState, useMemo } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, RotateCcw, TrendingUp, DollarSign, Package } from "lucide-react";
import { toast } from "sonner";

const currencies = [
  { code: "EUR", symbol: "€" },
  { code: "USD", symbol: "$" },
  { code: "GBP", symbol: "£" },
  { code: "CHF", symbol: "CHF" },
];

export default function BreakEvenCalculator() {
  const [fixedCosts, setFixedCosts] = useState<string>("5000");
  const [variableCost, setVariableCost] = useState<string>("25");
  const [sellingPrice, setSellingPrice] = useState<string>("50");
  const [currency, setCurrency] = useState("EUR");

  const currencySymbol = currencies.find((c) => c.code === currency)?.symbol || "€";

  const calculations = useMemo(() => {
    const fixed = parseFloat(fixedCosts) || 0;
    const variable = parseFloat(variableCost) || 0;
    const price = parseFloat(sellingPrice) || 0;

    const contributionMargin = price - variable;
    const breakEvenUnits = contributionMargin > 0 ? Math.ceil(fixed / contributionMargin) : 0;
    const breakEvenRevenue = breakEvenUnits * price;
    const contributionMarginRatio = price > 0 ? (contributionMargin / price) * 100 : 0;

    return {
      contributionMargin,
      breakEvenUnits,
      breakEvenRevenue,
      contributionMarginRatio,
      isValid: contributionMargin > 0,
    };
  }, [fixedCosts, variableCost, sellingPrice]);

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleCopy = () => {
    const text = `Break-Even Analysis
Fixed Costs: ${formatCurrency(parseFloat(fixedCosts) || 0)}/month
Variable Cost per Unit: ${formatCurrency(parseFloat(variableCost) || 0)}
Selling Price per Unit: ${formatCurrency(parseFloat(sellingPrice) || 0)}

Results:
Break-Even Point: ${calculations.breakEvenUnits.toLocaleString()} units
Break-Even Revenue: ${formatCurrency(calculations.breakEvenRevenue)}
Contribution Margin: ${formatCurrency(calculations.contributionMargin)} per unit
Contribution Margin Ratio: ${calculations.contributionMarginRatio.toFixed(1)}%`;

    navigator.clipboard.writeText(text);
    toast.success("Results copied to clipboard");
  };

  const handleReset = () => {
    setFixedCosts("5000");
    setVariableCost("25");
    setSellingPrice("50");
    toast.success("Calculator reset");
  };

  // Generate data points for the chart
  const chartData = useMemo(() => {
    const fixed = parseFloat(fixedCosts) || 0;
    const variable = parseFloat(variableCost) || 0;
    const price = parseFloat(sellingPrice) || 0;
    const breakEven = calculations.breakEvenUnits;

    const maxUnits = Math.max(breakEven * 2, 100);
    const points = [];

    for (let units = 0; units <= maxUnits; units += Math.ceil(maxUnits / 20)) {
      points.push({
        units,
        totalCost: fixed + variable * units,
        revenue: price * units,
        profit: price * units - (fixed + variable * units),
      });
    }

    return points;
  }, [fixedCosts, variableCost, sellingPrice, calculations.breakEvenUnits]);

  const maxValue = Math.max(...chartData.map((d) => Math.max(d.totalCost, d.revenue)));

  return (
    <ToolLayout title="Break-Even Calculator" description="Find your break-even point in units and revenue">
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
                <Label htmlFor="fixedCosts">Fixed Monthly Costs ({currencySymbol})</Label>
                <Input
                  id="fixedCosts"
                  type="number"
                  min="0"
                  step="100"
                  value={fixedCosts}
                  onChange={(e) => setFixedCosts(e.target.value)}
                  placeholder="5000"
                />
                <p className="text-xs text-muted-foreground mt-1">Rent, salaries, insurance, etc.</p>
              </div>

              <div>
                <Label htmlFor="variableCost">Variable Cost per Unit ({currencySymbol})</Label>
                <Input
                  id="variableCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={variableCost}
                  onChange={(e) => setVariableCost(e.target.value)}
                  placeholder="25"
                />
                <p className="text-xs text-muted-foreground mt-1">Materials, labor per unit, shipping</p>
              </div>

              <div>
                <Label htmlFor="sellingPrice">Selling Price per Unit ({currencySymbol})</Label>
                <Input
                  id="sellingPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="50"
                />
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
          {!calculations.isValid ? (
            <div className="bg-destructive/10 rounded-xl p-6 border border-destructive/20">
              <p className="text-destructive font-medium">
                Selling price must be higher than variable cost to break even.
              </p>
            </div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary/10 rounded-xl p-6 border border-primary/20">
                  <div className="flex items-center gap-2 text-primary mb-2">
                    <Package className="h-5 w-5" />
                    <span className="text-sm font-medium">Break-Even Units</span>
                  </div>
                  <p className="text-3xl font-bold text-foreground">{calculations.breakEvenUnits.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">units/month</p>
                </div>

                <div className="bg-green-500/10 rounded-xl p-6 border border-green-500/20">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <DollarSign className="h-5 w-5" />
                    <span className="text-sm font-medium">Break-Even Revenue</span>
                  </div>
                  <p className="text-3xl font-bold text-foreground">{formatCurrency(calculations.breakEvenRevenue)}</p>
                  <p className="text-sm text-muted-foreground mt-1">per month</p>
                </div>
              </div>

              {/* Additional Metrics */}
              <div className="bg-surface-elevated rounded-xl p-6 border border-border">
                <h3 className="font-semibold text-foreground mb-4">Analysis</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Contribution Margin</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(calculations.contributionMargin)} / unit
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Contribution Margin Ratio</span>
                    <span className="font-semibold text-foreground">
                      {calculations.contributionMarginRatio.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.min(calculations.contributionMarginRatio, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Visual Chart */}
              <div className="bg-surface-elevated rounded-xl p-6 border border-border">
                <h3 className="font-semibold text-foreground mb-4">Profit/Loss Chart</h3>
                <div className="relative h-48">
                  {/* Y Axis */}
                  <div className="absolute left-0 top-0 bottom-6 w-16 flex flex-col justify-between text-xs text-muted-foreground">
                    <span>{formatCurrency(maxValue)}</span>
                    <span>{formatCurrency(maxValue / 2)}</span>
                    <span>{currencySymbol}0</span>
                  </div>

                  {/* Chart Area */}
                  <div className="ml-16 h-full border-l border-b border-border relative">
                    {/* Break-even line */}
                    <div
                      className="absolute bottom-0 w-0.5 bg-primary/50"
                      style={{
                        left: `${(calculations.breakEvenUnits / (calculations.breakEvenUnits * 2)) * 100}%`,
                        height: "100%",
                      }}
                    />

                    {/* Revenue line */}
                    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                      <polyline
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                        points={chartData
                          .map(
                            (d, i) => `${(i / (chartData.length - 1)) * 100}%,${100 - (d.revenue / maxValue) * 100}%`,
                          )
                          .join(" ")}
                      />
                      <polyline
                        fill="none"
                        stroke="hsl(var(--destructive))"
                        strokeWidth="2"
                        points={chartData
                          .map(
                            (d, i) => `${(i / (chartData.length - 1)) * 100}%,${100 - (d.totalCost / maxValue) * 100}%`,
                          )
                          .join(" ")}
                      />
                    </svg>

                    {/* Break-even point marker */}
                    <div
                      className="absolute w-3 h-3 bg-primary rounded-full border-2 border-white shadow-md"
                      style={{
                        left: `${(calculations.breakEvenUnits / (calculations.breakEvenUnits * 2)) * 100}%`,
                        bottom: `${(calculations.breakEvenRevenue / maxValue) * 100}%`,
                        transform: "translate(-50%, 50%)",
                      }}
                    />
                  </div>

                  {/* X Axis */}
                  <div className="ml-16 flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0</span>
                    <span>{calculations.breakEvenUnits} units</span>
                    <span>{calculations.breakEvenUnits * 2}</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex gap-6 mt-4 justify-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-sm text-muted-foreground">Revenue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive" />
                    <span className="text-sm text-muted-foreground">Total Cost</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}
