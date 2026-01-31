import { Check, Cpu, ShieldCheck } from 'lucide-react';

interface LocalStatusIndicatorProps {
  showSaved?: boolean;
  className?: string;
}

export function LocalStatusIndicator({ showSaved, className }: LocalStatusIndicatorProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
        <Cpu className="h-3 w-3" />
        Local Processing
      </div>
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 text-xs font-medium">
        <ShieldCheck className="h-3 w-3" />
        No Uploads
      </div>
      {showSaved && (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <Check className="h-3 w-3" />
          Saved locally
        </div>
      )}
    </div>
  );
}
