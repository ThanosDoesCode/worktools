import { useState, useRef } from 'react';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Copy, RotateCcw, Upload, Check } from 'lucide-react';
import { toast } from 'sonner';

interface SignatureData {
  fullName: string;
  jobTitle: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  linkedin: string;
  brandColor: string;
  logoUrl: string;
}

const defaultData: SignatureData = {
  fullName: 'John Smith',
  jobTitle: 'Senior Product Manager',
  company: 'Acme Corporation',
  phone: '+1 (555) 123-4567',
  email: 'john.smith@acme.com',
  website: 'www.acme.com',
  linkedin: 'johnsmith',
  brandColor: '#2563eb',
  logoUrl: '',
};

export default function EmailSignatureGenerator() {
  const [data, setData] = useState<SignatureData>(defaultData);
  const [copied, setCopied] = useState(false);
  const signatureRef = useRef<HTMLDivElement>(null);

  const updateField = (field: keyof SignatureData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    setData(defaultData);
  };

  const handleCopyHtml = async () => {
    if (signatureRef.current) {
      const html = signatureRef.current.innerHTML;
      await navigator.clipboard.writeText(html);
      setCopied(true);
      toast.success('HTML signature copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyRichText = async () => {
    if (signatureRef.current) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(signatureRef.current);
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      try {
        document.execCommand('copy');
        toast.success('Rich text signature copied! Paste directly into your email client.');
      } catch {
        toast.error('Failed to copy. Please select and copy manually.');
      }
      
      selection?.removeAllRanges();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateField('logoUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <ToolLayout
      title="Email Signature Generator"
      description="Create professional email signatures compatible with Gmail, Outlook, and more"
    >
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Input Panel */}
        <div className="tool-input-panel space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
              <Input
                id="fullName"
                value={data.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                placeholder="John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle" className="text-sm font-medium">Job Title</Label>
              <Input
                id="jobTitle"
                value={data.jobTitle}
                onChange={(e) => updateField('jobTitle', e.target.value)}
                placeholder="Product Manager"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company" className="text-sm font-medium">Company</Label>
            <Input
              id="company"
              value={data.company}
              onChange={(e) => updateField('company', e.target.value)}
              placeholder="Acme Corporation"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
              <Input
                id="phone"
                value={data.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                value={data.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="john@acme.com"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="website" className="text-sm font-medium">Website</Label>
              <Input
                id="website"
                value={data.website}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder="www.acme.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin" className="text-sm font-medium">LinkedIn Username</Label>
              <Input
                id="linkedin"
                value={data.linkedin}
                onChange={(e) => updateField('linkedin', e.target.value)}
                placeholder="johnsmith"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brandColor" className="text-sm font-medium">Brand Color</Label>
              <div className="flex gap-2">
                <Input
                  id="brandColor"
                  type="color"
                  value={data.brandColor}
                  onChange={(e) => updateField('brandColor', e.target.value)}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={data.brandColor}
                  onChange={(e) => updateField('brandColor', e.target.value)}
                  placeholder="#2563eb"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Company Logo</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('logo-upload')?.click()}
                  className="gap-2 flex-1"
                >
                  <Upload className="h-4 w-4" />
                  Upload Logo
                </Button>
                {data.logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => updateField('logoUrl', '')}
                    className="text-destructive"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        {/* Output Panel */}
        <div className="tool-output-panel space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Preview
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCopyRichText} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Copy Rich Text
              </Button>
              <Button size="sm" onClick={handleCopyHtml} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy HTML
              </Button>
            </div>
          </div>

          {/* Signature Preview */}
          <div className="p-6 bg-background rounded-lg border border-border">
            <div ref={signatureRef}>
              <table cellPadding="0" cellSpacing="0" style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#333333' }}>
                <tbody>
                  <tr>
                    {data.logoUrl && (
                      <td style={{ paddingRight: '16px', verticalAlign: 'top' }}>
                        <img 
                          src={data.logoUrl} 
                          alt="Company Logo" 
                          style={{ width: '80px', height: 'auto', borderRadius: '4px' }}
                        />
                      </td>
                    )}
                    <td style={{ verticalAlign: 'top', borderLeft: data.logoUrl ? `3px solid ${data.brandColor}` : 'none', paddingLeft: data.logoUrl ? '16px' : '0' }}>
                      <table cellPadding="0" cellSpacing="0">
                        <tbody>
                          <tr>
                            <td style={{ paddingBottom: '4px' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '16px', color: data.brandColor }}>
                                {data.fullName}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ paddingBottom: '8px' }}>
                              <span style={{ color: '#666666' }}>
                                {data.jobTitle} {data.company && `| ${data.company}`}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ paddingBottom: '4px' }}>
                              {data.phone && (
                                <span style={{ color: '#333333' }}>
                                  📞 {data.phone}
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ paddingBottom: '4px' }}>
                              {data.email && (
                                <a href={`mailto:${data.email}`} style={{ color: data.brandColor, textDecoration: 'none' }}>
                                  ✉️ {data.email}
                                </a>
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ paddingBottom: '4px' }}>
                              {data.website && (
                                <a href={`https://${data.website}`} style={{ color: data.brandColor, textDecoration: 'none' }}>
                                  🌐 {data.website}
                                </a>
                              )}
                            </td>
                          </tr>
                          {data.linkedin && (
                            <tr>
                              <td>
                                <a 
                                  href={`https://linkedin.com/in/${data.linkedin}`} 
                                  style={{ color: '#0077b5', textDecoration: 'none' }}
                                >
                                  💼 LinkedIn
                                </a>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">How to use:</p>
            <ol className="mt-2 space-y-1 list-decimal list-inside">
              <li>Click "Copy Rich Text" for Gmail, Outlook, or Apple Mail</li>
              <li>Go to your email client's signature settings</li>
              <li>Paste the signature directly</li>
            </ol>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
