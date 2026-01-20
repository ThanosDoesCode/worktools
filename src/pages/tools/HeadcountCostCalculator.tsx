import { useState, useMemo } from 'react';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, RotateCcw, Users, Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';

const currencies = [
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'CHF', symbol: 'CHF' },
];

export default function HeadcountCostCalculator() {
  const [grossSalary, setGrossSalary] = useState<string>('60000');
  const [employerTaxRate, setEmployerTaxRate] = useState<string>('25');
  const [benefitsCost, setBenefitsCost] = useState<string>('3000');
  const [equipmentCost, setEquipmentCost] = useState<string>('2000');
  const [bonuses, setBonuses] = useState<string>('5000');
  const [workingHoursPerWeek, setWorkingHoursPerWeek] = useState<string>('40');
  const [vacationDays, setVacationDays] = useState<string>('25');
  const [currency, setCurrency] = useState('EUR');

  const currencySymbol = currencies.find(c => c.code === currency)?.symbol || '€';

  const calculations = useMemo(() => {
    const salary = parseFloat(grossSalary) || 0;
    const taxRate = parseFloat(employerTaxRate) || 0;
    const benefits = parseFloat(benefitsCost) || 0;
    const equipment = parseFloat(equipmentCost) || 0;
    const bonus = parseFloat(bonuses) || 0;
    const hoursPerWeek = parseFloat(workingHoursPerWeek) || 40;
    const vacation = parseFloat(vacationDays) || 0;

    // Calculate employer taxes
    const employerTaxes = salary * (taxRate / 100);
    
    // Total annual cost
    const totalAnnualCost = salary + employerTaxes + benefits + equipment + bonus;
    
    // Monthly cost
    const totalMonthlyCost = totalAnnualCost / 12;
    
    // Working hours calculation
    const totalWorkDays = 52 * 5; // 52 weeks * 5 days
    const publicHolidays = 10; // Average
    const actualWorkDays = totalWorkDays - vacation - publicHolidays;
    const actualWorkHours = actualWorkDays * (hoursPerWeek / 5);
    
    // Cost per hour
    const costPerHour = actualWorkHours > 0 ? totalAnnualCost / actualWorkHours : 0;

    // Cost breakdown percentages
    const breakdownPercentages = {
      salary: (salary / totalAnnualCost) * 100,
      taxes: (employerTaxes / totalAnnualCost) * 100,
      benefits: (benefits / totalAnnualCost) * 100,
      equipment: (equipment / totalAnnualCost) * 100,
      bonuses: (bonus / totalAnnualCost) * 100
    };

    return {
      employerTaxes,
      totalAnnualCost,
      totalMonthlyCost,
      actualWorkDays,
      actualWorkHours,
      costPerHour,
      breakdownPercentages
    };
  }, [grossSalary, employerTaxRate, benefitsCost, equipmentCost, bonuses, workingHoursPerWeek, vacationDays]);

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleCopy = () => {
    const text = `Headcount Cost Analysis
Gross Salary: ${formatCurrency(parseFloat(grossSalary) || 0)}/year
Employer Tax Rate: ${employerTaxRate}%
Benefits: ${formatCurrency(parseFloat(benefitsCost) || 0)}/year
Equipment: ${formatCurrency(parseFloat(equipmentCost) || 0)}/year
Bonuses: ${formatCurrency(parseFloat(bonuses) || 0)}/year

Results:
Total Annual Cost: ${formatCurrency(calculations.totalAnnualCost)}
Total Monthly Cost: ${formatCurrency(calculations.totalMonthlyCost)}
Cost per Working Hour: ${formatCurrency(calculations.costPerHour)}
Actual Working Hours/Year: ${calculations.actualWorkHours.toFixed(0)}`;
    
    navigator.clipboard.writeText(text);
    toast.success('Results copied to clipboard');
  };

  const handleReset = () => {
    setGrossSalary('60000');
    setEmployerTaxRate('25');
    setBenefitsCost('3000');
    setEquipmentCost('2000');
    setBonuses('5000');
    setWorkingHoursPerWeek('40');
    setVacationDays('25');
    toast.success('Calculator reset');
  };

  return (
    <ToolLayout
      title="Headcount Cost Calculator"
      description="Calculate true employee costs including taxes and benefits"
    >
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Input Panel */}
        <div className="space-y-6">
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-4">Compensation</h3>
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
                <Label htmlFor="grossSalary">Gross Annual Salary ({currencySymbol})</Label>
                <Input
                  id="grossSalary"
                  type="number"
                  min="0"
                  step="1000"
                  value={grossSalary}
                  onChange={(e) => setGrossSalary(e.target.value)}
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
                  value={employerTaxRate}
                  onChange={(e) => setEmployerTaxRate(e.target.value)}
                  placeholder="25"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Social security, payroll taxes
                </p>
              </div>

              <div>
                <Label htmlFor="bonuses">Annual Bonuses ({currencySymbol})</Label>
                <Input
                  id="bonuses"
                  type="number"
                  min="0"
                  step="500"
                  value={bonuses}
                  onChange={(e) => setBonuses(e.target.value)}
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
                  value={benefitsCost}
                  onChange={(e) => setBenefitsCost(e.target.value)}
                  placeholder="3000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Health insurance, pension, perks
                </p>
              </div>

              <div>
                <Label htmlFor="equipmentCost">Annual Equipment Cost ({currencySymbol})</Label>
                <Input
                  id="equipmentCost"
                  type="number"
                  min="0"
                  step="100"
                  value={equipmentCost}
                  onChange={(e) => setEquipmentCost(e.target.value)}
                  placeholder="2000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Laptop, software, office supplies
                </p>
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
                  value={workingHoursPerWeek}
                  onChange={(e) => setWorkingHoursPerWeek(e.target.value)}
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
                  value={vacationDays}
                  onChange={(e) => setVacationDays(e.target.value)}
                  placeholder="25"
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
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-primary/10 rounded-xl p-6 border border-primary/20">
              <div className="flex items-center gap-2 text-primary mb-2">
                <Users className="h-5 w-5" />
                <span className="text-sm font-medium">Total Annual Cost</span>
              </div>
              <p className="text-4xl font-bold text-foreground">
                {formatCurrency(calculations.totalAnnualCost)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatCurrency(calculations.totalMonthlyCost)}/month
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-elevated rounded-xl p-6 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="h-5 w-5" />
                <span className="text-sm font-medium">Cost per Hour</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(calculations.costPerHour)}
              </p>
            </div>

            <div className="bg-surface-elevated rounded-xl p-6 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calendar className="h-5 w-5" />
                <span className="text-sm font-medium">Working Hours/Year</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {calculations.actualWorkHours.toFixed(0)}
              </p>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-4">Cost Breakdown</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Gross Salary</span>
                  <span className="font-medium">{formatCurrency(parseFloat(grossSalary) || 0)}</span>
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
                  <span className="text-muted-foreground">Employer Taxes ({employerTaxRate}%)</span>
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
                  <span className="font-medium">{formatCurrency(parseFloat(benefitsCost) || 0)}</span>
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
                  <span className="font-medium">{formatCurrency(parseFloat(equipmentCost) || 0)}</span>
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
                  <span className="font-medium">{formatCurrency(parseFloat(bonuses) || 0)}</span>
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
            <h3 className="font-semibold text-foreground mb-4">Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Actual work days/year</p>
                <p className="font-semibold text-foreground">{calculations.actualWorkDays}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cost multiplier</p>
                <p className="font-semibold text-foreground">
                  {((calculations.totalAnnualCost / (parseFloat(grossSalary) || 1))).toFixed(2)}x
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Daily cost</p>
                <p className="font-semibold text-foreground">
                  {formatCurrency(calculations.totalAnnualCost / calculations.actualWorkDays)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Weekly cost</p>
                <p className="font-semibold text-foreground">
                  {formatCurrency(calculations.totalAnnualCost / 52)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
