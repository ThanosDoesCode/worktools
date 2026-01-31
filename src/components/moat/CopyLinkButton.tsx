import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { buildShareableUrl } from '@/lib/urlState';

interface CopyLinkButtonProps {
  toolSlug: string;
  currentSettings: Record<string, unknown>;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function CopyLinkButton({
  toolSlug,
  currentSettings,
  variant = 'outline',
  size = 'sm',
  className,
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const url = buildShareableUrl(toolSlug, currentSettings);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Shareable link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={className}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-2" />
          Copied!
        </>
      ) : (
        <>
          <Link2 className="h-4 w-4 mr-2" />
          Copy Link
        </>
      )}
    </Button>
  );
}
