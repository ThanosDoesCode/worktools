import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDefaults } from '@/hooks/useDefaults';
import { Settings, Save, ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';

const currencies = [
  { code: 'EUR', name: 'Euro (€)' },
  { code: 'USD', name: 'US Dollar ($)' },
  { code: 'GBP', name: 'British Pound (£)' },
  { code: 'CHF', name: 'Swiss Franc' },
];

const qualityPresets = [
  { id: 'maximum', name: 'Maximum Quality' },
  { id: 'balanced', name: 'Balanced' },
  { id: 'compressed', name: 'Compressed' },
];

export default function PreferencesPage() {
  const { defaults, isLoading, lastSaved, updateDefaults } = useDefaults();
  const [localDefaults, setLocalDefaults] = useState(defaults);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state when defaults load
  useState(() => {
    setLocalDefaults(defaults);
  });

  const handleChange = (key: keyof typeof defaults, value: string) => {
    setLocalDefaults((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateDefaults(localDefaults);
      setHasChanges(false);
      toast.success('Preferences saved locally');
    } catch {
      toast.error('Failed to save preferences');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <Link 
          to="/" 
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All Tools
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Preferences</h1>
          </div>
          <p className="text-muted-foreground">
            Set your default settings for all tools
          </p>
        </div>

        <div className="max-w-xl space-y-6">
          <div className="bg-surface-elevated rounded-xl border border-border p-6 space-y-6">
            <div>
              <Label htmlFor="filename-pattern">Export Filename Pattern</Label>
              <Input
                id="filename-pattern"
                value={localDefaults.exportFilenamePattern}
                onChange={(e) => handleChange('exportFilenamePattern', e.target.value)}
                placeholder="{toolname}_{date}"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available: {'{toolname}'}, {'{date}'}, {'{time}'}
              </p>
            </div>

            <div>
              <Label htmlFor="quality-preset">Preferred Quality Preset</Label>
              <Select
                value={localDefaults.preferredQualityPreset}
                onValueChange={(v) => handleChange('preferredQualityPreset', v)}
              >
                <SelectTrigger id="quality-preset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {qualityPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="default-currency">Default Currency</Label>
              <Select
                value={localDefaults.defaultCurrency}
                onValueChange={(v) => handleChange('defaultCurrency', v)}
              >
                <SelectTrigger id="default-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="company-name">Company Name (optional)</Label>
              <Input
                id="company-name"
                value={localDefaults.companyName || ''}
                onChange={(e) => handleChange('companyName', e.target.value)}
                placeholder="Your company name"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Used in invoices and business documents
              </p>
            </div>

            <div>
              <Label htmlFor="brand-color">Brand Color (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="brand-color"
                  type="color"
                  value={localDefaults.brandColor || '#3b82f6'}
                  onChange={(e) => handleChange('brandColor', e.target.value)}
                  className="w-14 h-10 p-1"
                />
                <Input
                  value={localDefaults.brandColor || '#3b82f6'}
                  onChange={(e) => handleChange('brandColor', e.target.value)}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              {lastSaved && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-500" />
                  Saved locally
                </p>
              )}
            </div>
            <Button onClick={handleSave} disabled={!hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              Save Preferences
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
