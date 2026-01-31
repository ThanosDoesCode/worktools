import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Star,
  MoreVertical,
  Trash2,
  Edit2,
  Check,
  Save,
  RotateCcw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Preset } from '@/lib/localDb';
import { RecommendedPreset } from '@/hooks/usePresets';

interface PresetsPanelProps {
  userPresets: Preset[];
  recommendedPresets: RecommendedPreset[];
  isLoading: boolean;
  onApply: (preset: RecommendedPreset | Preset) => void;
  onSave: (name: string, description?: string) => Promise<unknown>;
  onRename: (presetId: string, newName: string) => Promise<void>;
  onDelete: (presetId: string) => Promise<void>;
  onTogglePinned: (presetId: string) => Promise<void>;
  onUseLastSettings: () => Promise<boolean>;
  onReset: () => void;
}

export function PresetsPanel({
  userPresets,
  recommendedPresets,
  isLoading,
  onApply,
  onSave,
  onRename,
  onDelete,
  onTogglePinned,
  onUseLastSettings,
  onReset,
}: PresetsPanelProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);

  const handleSave = async () => {
    if (!presetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }
    try {
      await onSave(presetName.trim(), presetDescription.trim() || undefined);
      toast.success('Preset saved locally');
      setSaveDialogOpen(false);
      setPresetName('');
      setPresetDescription('');
    } catch {
      toast.error('Failed to save preset');
    }
  };

  const handleRename = async () => {
    if (!editingPreset || !presetName.trim()) return;
    try {
      await onRename(editingPreset.id, presetName.trim());
      toast.success('Preset renamed');
      setRenameDialogOpen(false);
      setEditingPreset(null);
      setPresetName('');
    } catch {
      toast.error('Failed to rename preset');
    }
  };

  const handleDelete = async (presetId: string) => {
    try {
      await onDelete(presetId);
      toast.success('Preset deleted');
    } catch {
      toast.error('Failed to delete preset');
    }
  };

  const handleUseLastSettings = async () => {
    const success = await onUseLastSettings();
    if (success) {
      toast.success('Loaded last used settings');
    } else {
      toast.info('No previous settings found');
    }
  };

  const openRenameDialog = (preset: Preset) => {
    setEditingPreset(preset);
    setPresetName(preset.name);
    setRenameDialogOpen(true);
  };

  return (
    <div className="bg-surface-elevated rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground text-sm">Presets</h3>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUseLastSettings}
            className="text-xs"
          >
            <Clock className="h-3 w-3 mr-1" />
            Last
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      <Tabs defaultValue="recommended" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-3">
          <TabsTrigger value="recommended" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Recommended
          </TabsTrigger>
          <TabsTrigger value="my-presets" className="text-xs">
            My Presets ({userPresets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recommended" className="space-y-2">
          {recommendedPresets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recommended presets for this tool
            </p>
          ) : (
            recommendedPresets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center justify-between p-2 rounded-lg border border-border hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {preset.name}
                  </p>
                  {preset.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {preset.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onApply(preset)}
                  className="ml-2"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Apply
                </Button>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="my-presets" className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Loading...
            </p>
          ) : userPresets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No saved presets yet
            </p>
          ) : (
            userPresets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center justify-between p-2 rounded-lg border border-border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {preset.pinned && (
                    <Star className="h-3 w-3 text-yellow-500 flex-shrink-0 fill-yellow-500" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {preset.name}
                    </p>
                    {preset.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {preset.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onApply(preset)}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onTogglePinned(preset.id)}>
                        <Star className="h-4 w-4 mr-2" />
                        {preset.pinned ? 'Unpin' : 'Pin'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openRenameDialog(preset)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(preset.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Button
        onClick={() => setSaveDialogOpen(true)}
        variant="outline"
        className="w-full mt-3"
        size="sm"
      >
        <Save className="h-3 w-3 mr-2" />
        Save Current as Preset
      </Button>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Preset</DialogTitle>
            <DialogDescription>
              Save your current settings as a reusable preset
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="preset-name">Name *</Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="My custom preset"
              />
            </div>
            <div>
              <Label htmlFor="preset-desc">Description (optional)</Label>
              <Input
                id="preset-desc"
                value={presetDescription}
                onChange={(e) => setPresetDescription(e.target.value)}
                placeholder="Short description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Preset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Preset</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rename-name">New Name</Label>
            <Input
              id="rename-name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
