import { useState, useMemo } from 'react';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, RotateCcw, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const euVatRates: Record<string, number> = {
  'Austria': 20,
  'Belgium': 21,
  'Bulgaria': 20,
  'Croatia': 25,
  'Cyprus': 19,
  'Czech Republic': 21,
  'Denmark': 25,
  'Estonia': 22,
  'Finland': 24,
  'France': 20,
  'Germany': 19,
  'Greece': 24,
  'Hungary': 27,
  'Ireland': 23,
  'Italy': 22,
  'Latvia': 21,
  'Lithuania': 21,
  'Luxembourg': 17,
  'Malta': 18,
  'Netherlands': 21,
  'Poland': 23,
  'Portugal': 23,
  'Romania': 19,
  'Slovakia': 20,
  'Slovenia': 22,
  'Spain': 21,
  'Sweden': 25,
  'UK': 20,
};

type Mode = 'add' | 'remove';

export default function VATCalculator() {
  const [amount, setAmount] = useState<string>('1000');
  const [country, setCountry] = useState<string>('Germany');
  const [customRate, setCustomRate] = useState<string>('');
  const [mode, setMode] = useState<Mode>('add');

  const vatRate = customRate ? parseFloat(customRate) : euVatRates[country] || 20;

  const calculations = useMemo(() => {
    const amt = parseFloat(amount) || 0;
    const rate = vatRate / 100;
    
    if (amt <= 0) {
      return { net: 0, vat: 0, gross: 0, isValid: false };
    }
    
    if (mode === 'add') {
      // Amount is NET, add VAT
      const vat = amt * rate;
      const gross = amt + vat;
      return { net: amt, vat, gross, isValid: true };
    } else {
      // Amount is GROSS, remove VAT
      const net = amt / (1 + rate);
      const vat = amt - net;
      return { net, vat, gross: amt, isValid: true };
    }
  }, [amount, vatRate, mode]);

  const handleReset = () => {
    setAmount('1000');
    setCountry('Germany');
    setCustomRate('');
    setMode('add');
  };

  const handleCopy = () => {
    const text = `Net Amount: $${calculations.net.toFixed(2)}\nVAT (${vatRate}%): $${calculations.vat.toFixed(2)}\nGross Amount: $${calculations.gross.toFixed(2)}`;
    navigator.clipboard.writeText(text);
    toast.success('Results copied to clipboard');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <ToolLayout
      title="VAT Calculator"
      description="Add or remove VAT from any amount with EU rates"
    >
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Input Panel */}
        <div className="tool-input-panel space-y-6">
          {/* Mode Toggle */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Calculation Mode</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mode === 'add' ? 'default' : 'outline'}
                onClick={() => setMode('add')}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add VAT
              </Button>
              <Button
                type="button"
                variant={mode === 'remove' ? 'default' : 'outline'}
                onClick={() => setMode('remove')}
                className="gap-2"
              >
                <Minus className="h-4 w-4" />
                Remove VAT
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === 'add' 
                ? 'Enter net amount to calculate gross with VAT' 
                : 'Enter gross amount to extract VAT'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm font-medium">
              {mode === 'add' ? 'Net Amount' : 'Gross Amount'}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8"
                placeholder="Enter amount"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Country / VAT Rate</Label>
            <Select value={country} onValueChange={(val) => {
              setCountry(val);
              setCustomRate('');
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(euVatRates).map(([name, rate]) => (
                  <SelectItem key={name} value={name}>
                    {name} ({rate}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customRate" className="text-sm font-medium">
              Or Custom VAT Rate (%)
            </Label>
            <Input
              id="customRate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
              placeholder="e.g., 15"
            />
            <p className="text-xs text-muted-foreground">
              Override the country rate with a custom percentage
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
            Breakdown
          </h3>
          
          {calculations.isValid ? (
            <div className="space-y-6">
              {/* Results Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className={cn(
                  "p-4 border-b border-border",
                  mode === 'add' ? "bg-muted/50" : "bg-background"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Net Amount</span>
                    <span className={cn(
                      "font-semibold",
                      mode === 'add' ? "text-foreground" : "text-success"
                    )}>
                      {formatCurrency(calculations.net)}
                    </span>
                  </div>
                </div>
                
                <div className="p-4 border-b border-border bg-info-light">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-info font-medium">VAT ({vatRate}%)</span>
                    <span className="font-semibold text-info">
                      {mode === 'add' ? '+' : '-'} {formatCurrency(calculations.vat)}
                    </span>
                  </div>
                </div>
                
                <div className={cn(
                  "p-4",
                  mode === 'remove' ? "bg-muted/50" : "bg-background"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Gross Amount</span>
                    <span className={cn(
                      "font-semibold",
                      mode === 'remove' ? "text-foreground" : "text-success"
                    )}>
                      {formatCurrency(calculations.gross)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Highlighted Result */}
              <div className="p-6 rounded-lg bg-success-light text-center">
                <p className="result-label text-success">
                  {mode === 'add' ? 'Total Including VAT' : 'Net Amount (Excluding VAT)'}
                </p>
                <p className="text-4xl font-bold text-success mt-2">
                  {formatCurrency(mode === 'add' ? calculations.gross : calculations.net)}
                </p>
              </div>

              <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                <p><strong>VAT Rate:</strong> {vatRate}% ({customRate ? 'Custom' : country})</p>
                <p className="mt-1"><strong>Formula:</strong></p>
                {mode === 'add' ? (
                  <p>Gross = Net × (1 + {vatRate}%)</p>
                ) : (
                  <p>Net = Gross ÷ (1 + {vatRate}%)</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              Enter a valid amount to see results
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}
