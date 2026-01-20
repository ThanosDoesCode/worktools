import { useState, useMemo } from 'react';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Copy, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

export default function MarginMarkupCalculator() {
  const [costPrice, setCostPrice] = useState<string>('100');
  const [sellingPrice, setSellingPrice] = useState<string>('150');

  const calculations = useMemo(() => {
    const cost = parseFloat(costPrice) || 0;
    const selling = parseFloat(sellingPrice) || 0;
    
    if (cost <= 0 || selling <= 0) {
      return { margin: 0, markup: 0, profit: 0, isValid: false };
    }
    
    const profit = selling - cost;
    const margin = (profit / selling) * 100;
    const markup = (profit / cost) * 100;
    
    return { margin, markup, profit, isValid: true };
  }, [costPrice, sellingPrice]);

  const handleReset = () => {
    setCostPrice('100');
    setSellingPrice('150');
  };

  const handleCopy = () => {
    const text = `Cost: $${costPrice}\nSelling Price: $${sellingPrice}\nMargin: ${calculations.margin.toFixed(2)}%\nMarkup: ${calculations.markup.toFixed(2)}%\nProfit: $${calculations.profit.toFixed(2)}`;
    navigator.clipboard.writeText(text);
    toast.success('Results copied to clipboard');
  };

  return (
    <ToolLayout
      title="Margin vs Markup Calculator"
      description="Calculate profit margins and markup percentages instantly"
    >
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Input Panel */}
        <div className="tool-input-panel space-y-6">
          <div className="space-y-2">
            <Label htmlFor="cost" className="text-sm font-medium">
              Cost Price
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
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
            <p className="text-xs text-muted-foreground">
              What you pay for the product or service
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="selling" className="text-sm font-medium">
              Selling Price
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
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
            <p className="text-xs text-muted-foreground">
              What you charge the customer
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button onClick={handleCopy} className="gap-2">
              <Copy className="h-4 w-4" />
              Copy Results
            </Button>
          </div>
        </div>

        {/* Output Panel */}
        <div className="tool-output-panel space-y-6">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Results
          </h3>
          
          {calculations.isValid ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="result-label">Margin</p>
                  <p className="result-highlight text-success">
                    {calculations.margin.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="result-label">Markup</p>
                  <p className="result-highlight text-info">
                    {calculations.markup.toFixed(2)}%
                  </p>
                </div>
              </div>
              
              <div className="border-t border-border pt-6">
                <p className="result-label">Profit per Unit</p>
                <p className="result-highlight">
                  ${calculations.profit.toFixed(2)}
                </p>
              </div>

              {/* Visual Comparison */}
              <div className="space-y-3 pt-4">
                <p className="text-sm font-medium text-foreground">Visual Comparison</p>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Margin</span>
                    <span className="font-medium text-success">{calculations.margin.toFixed(1)}%</span>
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
                    <span className="font-medium text-info">{calculations.markup.toFixed(1)}%</span>
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
              <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                <p><strong>Margin</strong> = Profit ÷ Selling Price × 100</p>
                <p className="mt-1"><strong>Markup</strong> = Profit ÷ Cost Price × 100</p>
              </div>
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
