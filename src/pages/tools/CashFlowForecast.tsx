import { useState, useMemo } from 'react';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, RotateCcw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const currencies = [
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'CHF', symbol: 'CHF' },
];

export default function CashFlowForecast() {
  const [openingBalance, setOpeningBalance] = useState<string>('50000');
  const [monthlyIncome, setMonthlyIncome] = useState<string>('25000');
  const [fixedCosts, setFixedCosts] = useState<string>('15000');
  const [variableCosts, setVariableCosts] = useState<string>('8000');
  const [currency, setCurrency] = useState('EUR');

  const currencySymbol = currencies.find(c => c.code === currency)?.symbol || '€';

  const calculations = useMemo(() => {
    const opening = parseFloat(openingBalance) || 0;
    const income = parseFloat(monthlyIncome) || 0;
    const fixed = parseFloat(fixedCosts) || 0;
    const variable = parseFloat(variableCosts) || 0;

    const totalExpenses = fixed + variable;
    const netCashFlow = income - totalExpenses;
    
    // Calculate runway (months until cash runs out)
    let runway = 0;
    if (netCashFlow < 0) {
      runway = Math.floor(opening / Math.abs(netCashFlow));
    } else if (netCashFlow === 0) {
      runway = opening > 0 ? Infinity : 0;
    } else {
      runway = Infinity; // Growing cash
    }

    // Generate 12-month projection
    const projection = [];
    let runningBalance = opening;
    for (let month = 0; month <= 12; month++) {
      projection.push({
        month,
        balance: runningBalance,
        income: month === 0 ? 0 : income,
        expenses: month === 0 ? 0 : totalExpenses,
        netFlow: month === 0 ? 0 : netCashFlow
      });
      runningBalance += netCashFlow;
    }

    return {
      netCashFlow,
      totalExpenses,
      runway,
      projection,
      isHealthy: netCashFlow >= 0,
      isWarning: netCashFlow < 0 && runway > 3,
      isCritical: netCashFlow < 0 && runway <= 3
    };
  }, [openingBalance, monthlyIncome, fixedCosts, variableCosts]);

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const handleCopy = () => {
    const text = `Cash Flow Forecast
Opening Balance: ${formatCurrency(parseFloat(openingBalance) || 0)}
Monthly Income: ${formatCurrency(parseFloat(monthlyIncome) || 0)}
Fixed Costs: ${formatCurrency(parseFloat(fixedCosts) || 0)}
Variable Costs: ${formatCurrency(parseFloat(variableCosts) || 0)}

Results:
Net Monthly Cash Flow: ${formatCurrency(calculations.netCashFlow)}
Business Runway: ${calculations.runway === Infinity ? 'Unlimited' : `${calculations.runway} months`}

12-Month Projection:
${calculations.projection.map(p => `Month ${p.month}: ${formatCurrency(p.balance)}`).join('\n')}`;
    
    navigator.clipboard.writeText(text);
    toast.success('Results copied to clipboard');
  };

  const handleReset = () => {
    setOpeningBalance('50000');
    setMonthlyIncome('25000');
    setFixedCosts('15000');
    setVariableCosts('8000');
    toast.success('Calculator reset');
  };

  const maxBalance = Math.max(...calculations.projection.map(p => Math.abs(p.balance)));
  const minBalance = Math.min(...calculations.projection.map(p => p.balance));

  return (
    <ToolLayout
      title="Cash Flow Forecast"
      description="Project your business cash flow and runway"
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
                <Label htmlFor="openingBalance">Opening Cash Balance ({currencySymbol})</Label>
                <Input
                  id="openingBalance"
                  type="number"
                  min="0"
                  step="1000"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="50000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Current cash in bank
                </p>
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
                  placeholder="25000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Expected monthly revenue
                </p>
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
                  placeholder="15000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Rent, salaries, subscriptions
                </p>
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
                  placeholder="8000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  COGS, marketing, supplies
                </p>
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
              calculations.isHealthy 
                ? 'bg-green-500/10 border-green-500/20' 
                : 'bg-destructive/10 border-destructive/20'
            }`}>
              <div className={`flex items-center gap-2 mb-2 ${
                calculations.isHealthy ? 'text-green-600' : 'text-destructive'
              }`}>
                {calculations.isHealthy ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                <span className="text-sm font-medium">Net Cash Flow</span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(calculations.netCashFlow)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">per month</p>
            </div>

            <div className={`rounded-xl p-6 border ${
              calculations.isCritical 
                ? 'bg-destructive/10 border-destructive/20'
                : calculations.isWarning 
                  ? 'bg-yellow-500/10 border-yellow-500/20'
                  : 'bg-green-500/10 border-green-500/20'
            }`}>
              <div className={`flex items-center gap-2 mb-2 ${
                calculations.isCritical 
                  ? 'text-destructive'
                  : calculations.isWarning 
                    ? 'text-yellow-600'
                    : 'text-green-600'
              }`}>
                {calculations.isCritical ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                <span className="text-sm font-medium">Business Runway</span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {calculations.runway === Infinity ? '∞' : calculations.runway}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {calculations.runway === Infinity ? 'Growing cash' : 'months remaining'}
              </p>
            </div>
          </div>

          {/* Status Warning */}
          {calculations.isCritical && (
            <div className="bg-destructive/10 rounded-xl p-4 border border-destructive/20 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Critical: Low Runway</p>
                <p className="text-sm text-muted-foreground mt-1">
                  At current burn rate, you have only {calculations.runway} months of cash remaining. 
                  Consider reducing costs or increasing revenue immediately.
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
              <div className={`flex justify-between items-center font-semibold ${
                calculations.netCashFlow >= 0 ? 'text-green-600' : 'text-destructive'
              }`}>
                <span>Net Cash Flow</span>
                <span>{calculations.netCashFlow >= 0 ? '+' : ''}{formatCurrency(calculations.netCashFlow)}</span>
              </div>
            </div>
          </div>

          {/* 12 Month Chart */}
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-4">12-Month Projection</h3>
            <div className="relative h-48">
              {/* Zero line if needed */}
              {minBalance < 0 && (
                <div 
                  className="absolute left-8 right-0 border-t border-destructive/50 border-dashed"
                  style={{ 
                    bottom: `${(Math.abs(minBalance) / (maxBalance - minBalance)) * 100}%` 
                  }}
                />
              )}
              
              {/* Bars */}
              <div className="absolute inset-0 flex items-end justify-between gap-1 pl-8">
                {calculations.projection.map((point, index) => {
                  const height = maxBalance > 0 
                    ? Math.abs(point.balance) / maxBalance * 100 
                    : 0;
                  const isNegative = point.balance < 0;
                  
                  return (
                    <div 
                      key={index} 
                      className="flex-1 flex flex-col justify-end items-center"
                      style={{ height: '100%' }}
                    >
                      <div 
                        className={`w-full rounded-t transition-all duration-300 ${
                          isNegative ? 'bg-destructive' : 'bg-primary'
                        }`}
                        style={{ height: `${Math.min(height, 100)}%` }}
                        title={`Month ${point.month}: ${formatCurrency(point.balance)}`}
                      />
                    </div>
                  );
                })}
              </div>
              
              {/* Y Axis Labels */}
              <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-xs text-muted-foreground">
                <span>{formatCurrency(maxBalance)}</span>
                <span>{formatCurrency(maxBalance / 2)}</span>
                <span>{currencySymbol}0</span>
              </div>
            </div>
            
            {/* X Axis */}
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
                  className={`p-2 rounded text-center ${
                    point.balance < 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted/50'
                  }`}
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
