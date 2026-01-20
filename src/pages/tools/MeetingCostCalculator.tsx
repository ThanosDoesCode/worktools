import { useState, useMemo } from 'react';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Copy, RotateCcw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function MeetingCostCalculator() {
  const [participants, setParticipants] = useState<string>('5');
  const [hourlySalary, setHourlySalary] = useState<string>('50');
  const [duration, setDuration] = useState<string>('60');
  const [frequency, setFrequency] = useState<string>('4'); // times per month

  const calculations = useMemo(() => {
    const p = parseFloat(participants) || 0;
    const salary = parseFloat(hourlySalary) || 0;
    const dur = parseFloat(duration) || 0;
    const freq = parseFloat(frequency) || 0;
    
    if (p <= 0 || salary <= 0 || dur <= 0) {
      return { meetingCost: 0, costPerMinute: 0, monthlyCost: 0, annualCost: 0, isValid: false };
    }
    
    const hoursInMeeting = dur / 60;
    const meetingCost = p * salary * hoursInMeeting;
    const costPerMinute = meetingCost / dur;
    const monthlyCost = meetingCost * freq;
    const annualCost = monthlyCost * 12;
    
    return { meetingCost, costPerMinute, monthlyCost, annualCost, isValid: true };
  }, [participants, hourlySalary, duration, frequency]);

  const handleReset = () => {
    setParticipants('5');
    setHourlySalary('50');
    setDuration('60');
    setFrequency('4');
  };

  const handleCopy = () => {
    const text = `Meeting Cost: $${calculations.meetingCost.toFixed(2)}\nCost per Minute: $${calculations.costPerMinute.toFixed(2)}\nMonthly Cost: $${calculations.monthlyCost.toFixed(2)}\nAnnual Cost: $${calculations.annualCost.toFixed(2)}`;
    navigator.clipboard.writeText(text);
    toast.success('Results copied to clipboard');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <ToolLayout
      title="Meeting Cost Calculator"
      description="Calculate how much your meetings really cost"
    >
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Input Panel */}
        <div className="tool-input-panel space-y-6">
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
            <p className="text-xs text-muted-foreground">
              Everyone attending the meeting
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="salary" className="text-sm font-medium">
              Average Hourly Salary
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
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
            <p className="text-xs text-muted-foreground">
              Average hourly rate of attendees
            </p>
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
            <p className="text-xs text-muted-foreground">
              Length of the meeting in minutes
            </p>
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
            <p className="text-xs text-muted-foreground">
              How often this meeting recurs monthly
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
            Meeting Costs
          </h3>
          
          {calculations.isValid ? (
            <div className="space-y-6">
              <div className="p-6 rounded-lg bg-muted/50 text-center">
                <p className="result-label">This Meeting Costs</p>
                <p className="text-4xl font-bold text-foreground mt-2">
                  {formatCurrency(calculations.meetingCost)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatCurrency(calculations.costPerMinute)}/minute
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-border">
                  <p className="result-label">Monthly Cost</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {formatCurrency(calculations.monthlyCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {frequency}× per month
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-border">
                  <p className="result-label">Annual Cost</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {formatCurrency(calculations.annualCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    12 months
                  </p>
                </div>
              </div>

              {calculations.annualCost > 50000 && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-warning-light">
                  <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">High Meeting Cost</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Consider if this meeting could be an email, reduced in duration, or have fewer attendees.
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                <p><strong>Formula:</strong></p>
                <p className="mt-1">Meeting Cost = Participants × Hourly Rate × (Duration ÷ 60)</p>
              </div>
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
