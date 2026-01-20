import { useState, useMemo } from 'react';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, RotateCcw, Tag, Percent, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const currencies = [
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'CHF', symbol: 'CHF' },
];

export default function PricingCalculator() {
  const [costPerUnit, setCostPerUnit] = useState<string>('50');
  const [targetPercentage, setTargetPercentage] = useState<string>('30');
  const [mode, setMode] = useState<'margin' | 'markup'>('margin');
  const [vatRate, setVatRate] = useState<string>('0');
  const [currency, setCurrency] = useState('EUR');

  const currencySymbol = currencies.find(c => c.code === currency)?.symbol || '€';

  const calculations = useMemo(() => {
    const cost = parseFloat(costPerUnit) || 0;
    const percentage = parseFloat(targetPercentage) || 0;
    const vat = parseFloat(vatRate) || 0;

    let sellingPriceExVat: number;
    let profitPerUnit: number;
    let actualMargin: number;
    let actualMarkup: number;

    if (mode === 'margin') {
      // Margin = (Selling Price - Cost) / Selling Price
      // So: Selling Price = Cost / (1 - Margin%)
      sellingPriceExVat = percentage < 100 ? cost / (1 - percentage / 100) : 0;
      profitPerUnit = sellingPriceExVat - cost;
      actualMargin = percentage;
      actualMarkup = cost > 0 ? (profitPerUnit / cost) * 100 : 0;
    } else {
      // Markup = (Selling Price - Cost) / Cost
      // So: Selling Price = Cost * (1 + Markup%)
      sellingPriceExVat = cost * (1 + percentage / 100);
      profitPerUnit = sellingPriceExVat - cost;
      actualMarkup = percentage;
      actualMargin = sellingPriceExVat > 0 ? (profitPerUnit / sellingPriceExVat) * 100 : 0;
    }

    const vatAmount = sellingPriceExVat * (vat / 100);
    const sellingPriceIncVat = sellingPriceExVat + vatAmount;

    return {
      sellingPriceExVat,
      sellingPriceIncVat,
      profitPerUnit,
      vatAmount,
      actualMargin,
      actualMarkup,
      isValid: sellingPriceExVat > 0 && profitPerUnit >= 0
    };
  }, [costPerUnit, targetPercentage, mode, vatRate]);

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleCopy = () => {
    const text = `Pricing Calculation
Cost per Unit: ${formatCurrency(parseFloat(costPerUnit) || 0)}
Target ${mode === 'margin' ? 'Margin' : 'Markup'}: ${targetPercentage}%
VAT Rate: ${vatRate}%

Results:
Selling Price (ex. VAT): ${formatCurrency(calculations.sellingPriceExVat)}
Selling Price (inc. VAT): ${formatCurrency(calculations.sellingPriceIncVat)}
Profit per Unit: ${formatCurrency(calculations.profitPerUnit)}
Margin: ${calculations.actualMargin.toFixed(1)}%
Markup: ${calculations.actualMarkup.toFixed(1)}%`;
    
    navigator.clipboard.writeText(text);
    toast.success('Results copied to clipboard');
  };

  const handleReset = () => {
    setCostPerUnit('50');
    setTargetPercentage('30');
    setVatRate('0');
    toast.success('Calculator reset');
  };

  return (
    <ToolLayout
      title="Pricing Calculator"
      description="Calculate optimal selling prices from costs and margins"
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
                <Label htmlFor="costPerUnit">Cost per Unit ({currencySymbol})</Label>
                <Input
                  id="costPerUnit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(e.target.value)}
                  placeholder="50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your cost to produce or acquire one unit
                </p>
              </div>

              <div>
                <Label>Calculate by</Label>
                <Tabs value={mode} onValueChange={(v) => setMode(v as 'margin' | 'markup')} className="mt-2">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="margin">Target Margin</TabsTrigger>
                    <TabsTrigger value="markup">Target Markup</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div>
                <Label htmlFor="targetPercentage">
                  {mode === 'margin' ? 'Target Margin' : 'Target Markup'} (%)
                </Label>
                <Input
                  id="targetPercentage"
                  type="number"
                  min="0"
                  max={mode === 'margin' ? '99.99' : '1000'}
                  step="0.1"
                  value={targetPercentage}
                  onChange={(e) => setTargetPercentage(e.target.value)}
                  placeholder="30"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {mode === 'margin' 
                    ? 'Margin = (Selling Price - Cost) / Selling Price'
                    : 'Markup = (Selling Price - Cost) / Cost'
                  }
                </p>
              </div>

              <div>
                <Label htmlFor="vatRate">VAT Rate (%) - Optional</Label>
                <Input
                  id="vatRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  placeholder="0"
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
                {parseFloat(targetPercentage) >= 100 && mode === 'margin'
                  ? 'Margin cannot be 100% or more'
                  : 'Please enter valid values'
                }
              </p>
            </div>
          ) : (
            <>
              {/* Recommended Price */}
              <div className="bg-primary/10 rounded-xl p-6 border border-primary/20">
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Tag className="h-5 w-5" />
                  <span className="text-sm font-medium">Recommended Selling Price</span>
                </div>
                <p className="text-4xl font-bold text-foreground">
                  {formatCurrency(calculations.sellingPriceExVat)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">excluding VAT</p>
                
                {parseFloat(vatRate) > 0 && (
                  <div className="mt-4 pt-4 border-t border-primary/20">
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(calculations.sellingPriceIncVat)}
                    </p>
                    <p className="text-sm text-muted-foreground">including {vatRate}% VAT</p>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="bg-surface-elevated rounded-xl p-6 border border-border">
                <h3 className="font-semibold text-foreground mb-4">Price Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-medium">{formatCurrency(parseFloat(costPerUnit) || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-green-600">
                    <span>+ Profit</span>
                    <span className="font-medium">{formatCurrency(calculations.profitPerUnit)}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(calculations.sellingPriceExVat)}</span>
                  </div>
                  {parseFloat(vatRate) > 0 && (
                    <>
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>+ VAT ({vatRate}%)</span>
                        <span>{formatCurrency(calculations.vatAmount)}</span>
                      </div>
                      <div className="h-px bg-border" />
                      <div className="flex justify-between items-center font-semibold">
                        <span>Total</span>
                        <span>{formatCurrency(calculations.sellingPriceIncVat)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Margin/Markup Comparison */}
              <div className="bg-surface-elevated rounded-xl p-6 border border-border">
                <h3 className="font-semibold text-foreground mb-4">Margin vs Markup</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                      <Percent className="h-4 w-4" />
                      <span className="text-sm">Margin</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {calculations.actualMargin.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">Markup</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {calculations.actualMarkup.toFixed(1)}%
                    </p>
                  </div>
                </div>
                
                {/* Visual comparison */}
                <div className="mt-4 space-y-2">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Cost</span>
                      <span>Selling Price</span>
                    </div>
                    <div className="h-6 bg-muted rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-muted-foreground/50 flex items-center justify-center text-xs text-white font-medium"
                        style={{ width: `${(parseFloat(costPerUnit) / calculations.sellingPriceExVat) * 100}%` }}
                      >
                        Cost
                      </div>
                      <div 
                        className="h-full bg-green-500 flex items-center justify-center text-xs text-white font-medium"
                        style={{ width: `${(calculations.profitPerUnit / calculations.sellingPriceExVat) * 100}%` }}
                      >
                        Profit
                      </div>
                    </div>
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
