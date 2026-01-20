import { useState, useMemo } from 'react';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, RotateCcw, TrendingUp, Clock, PiggyBank } from 'lucide-react';
import { toast } from 'sonner';

const currencies = [
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'CHF', symbol: 'CHF' },
];

export default function ROICalculator() {
  const [investmentCost, setInvestmentCost] = useState<string>('10000');
  const [expectedReturn, setExpectedReturn] = useState<string>('15000');
  const [timePeriod, setTimePeriod] = useState<string>('12');
  const [currency, setCurrency] = useState('EUR');

  const currencySymbol = currencies.find(c => c.code === currency)?.symbol || '€';

  const calculations = useMemo(() => {
    const investment = parseFloat(investmentCost) || 0;
    const returns = parseFloat(expectedReturn) || 0;
    const months = parseFloat(timePeriod) || 1;

    const netProfit = returns - investment;
    const roi = investment > 0 ? (netProfit / investment) * 100 : 0;
    const annualizedROI = months > 0 ? ((Math.pow(1 + (roi / 100), 12 / months) - 1) * 100) : 0;
    const monthlyReturn = months > 0 ? netProfit / months : 0;
    const paybackPeriod = monthlyReturn > 0 ? investment / monthlyReturn : 0;

    return {
      netProfit,
      roi,
      annualizedROI,
      monthlyReturn,
      paybackPeriod,
      isProfit: netProfit > 0
    };
  }, [investmentCost, expectedReturn, timePeriod]);

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleCopy = () => {
    const text = `ROI Analysis
Investment Cost: ${formatCurrency(parseFloat(investmentCost) || 0)}
Expected Return: ${formatCurrency(parseFloat(expectedReturn) || 0)}
Time Period: ${timePeriod} months

Results:
Net Profit: ${formatCurrency(calculations.netProfit)}
ROI: ${calculations.roi.toFixed(2)}%
Annualized ROI: ${calculations.annualizedROI.toFixed(2)}%
Payback Period: ${calculations.paybackPeriod.toFixed(1)} months`;
    
    navigator.clipboard.writeText(text);
    toast.success('Results copied to clipboard');
  };

  const handleReset = () => {
    setInvestmentCost('10000');
    setExpectedReturn('15000');
    setTimePeriod('12');
    toast.success('Calculator reset');
  };

  return (
    <ToolLayout
      title="ROI Calculator"
      description="Calculate return on investment and payback period"
    >
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
                    {currencies.map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.symbol} {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="investmentCost">Investment Cost ({currencySymbol})</Label>
                <Input
                  id="investmentCost"
                  type="number"
                  min="0"
                  step="100"
                  value={investmentCost}
                  onChange={(e) => setInvestmentCost(e.target.value)}
                  placeholder="10000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Total amount invested upfront
                </p>
              </div>

              <div>
                <Label htmlFor="expectedReturn">Expected Return ({currencySymbol})</Label>
                <Input
                  id="expectedReturn"
                  type="number"
                  min="0"
                  step="100"
                  value={expectedReturn}
                  onChange={(e) => setExpectedReturn(e.target.value)}
                  placeholder="15000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Total revenue or value generated
                </p>
              </div>

              <div>
                <Label htmlFor="timePeriod">Time Period (months)</Label>
                <Input
                  id="timePeriod"
                  type="number"
                  min="1"
                  max="120"
                  value={timePeriod}
                  onChange={(e) => setTimePeriod(e.target.value)}
                  placeholder="12"
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
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-xl p-6 border ${
              calculations.isProfit 
                ? 'bg-green-500/10 border-green-500/20' 
                : 'bg-destructive/10 border-destructive/20'
            }`}>
              <div className={`flex items-center gap-2 mb-2 ${
                calculations.isProfit ? 'text-green-600' : 'text-destructive'
              }`}>
                <PiggyBank className="h-5 w-5" />
                <span className="text-sm font-medium">Net Profit</span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(calculations.netProfit)}
              </p>
            </div>

            <div className={`rounded-xl p-6 border ${
              calculations.roi > 0 
                ? 'bg-primary/10 border-primary/20' 
                : 'bg-destructive/10 border-destructive/20'
            }`}>
              <div className={`flex items-center gap-2 mb-2 ${
                calculations.roi > 0 ? 'text-primary' : 'text-destructive'
              }`}>
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm font-medium">ROI</span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {calculations.roi.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* ROI Visual */}
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-4">ROI Breakdown</h3>
            <div className="space-y-4">
              {/* Investment vs Return Bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Investment</span>
                  <span className="font-medium">{formatCurrency(parseFloat(investmentCost) || 0)}</span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-muted-foreground/50 transition-all duration-300"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Return</span>
                  <span className="font-medium">{formatCurrency(parseFloat(expectedReturn) || 0)}</span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      calculations.isProfit ? 'bg-green-500' : 'bg-destructive'
                    }`}
                    style={{ 
                      width: `${Math.min(
                        ((parseFloat(expectedReturn) || 0) / (parseFloat(investmentCost) || 1)) * 100, 
                        200
                      )}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-4">Detailed Analysis</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Annualized ROI</span>
                </div>
                <span className={`font-semibold ${
                  calculations.annualizedROI > 0 ? 'text-green-600' : 'text-destructive'
                }`}>
                  {calculations.annualizedROI.toFixed(1)}%
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Monthly Return</span>
                </div>
                <span className="font-semibold text-foreground">
                  {formatCurrency(calculations.monthlyReturn)}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Payback Period</span>
                </div>
                <span className="font-semibold text-foreground">
                  {calculations.paybackPeriod > 0 
                    ? `${calculations.paybackPeriod.toFixed(1)} months`
                    : 'N/A'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Status Indicator */}
          <div className={`rounded-xl p-4 border ${
            calculations.roi >= 20 
              ? 'bg-green-500/10 border-green-500/20' 
              : calculations.roi > 0 
                ? 'bg-yellow-500/10 border-yellow-500/20'
                : 'bg-destructive/10 border-destructive/20'
          }`}>
            <p className={`text-sm font-medium text-center ${
              calculations.roi >= 20 
                ? 'text-green-600' 
                : calculations.roi > 0 
                  ? 'text-yellow-600'
                  : 'text-destructive'
            }`}>
              {calculations.roi >= 20 
                ? '✓ Strong return on investment' 
                : calculations.roi > 0 
                  ? '○ Positive but modest return'
                  : '✗ Investment results in a loss'
              }
            </p>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
