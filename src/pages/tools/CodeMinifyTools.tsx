import { useEffect, useMemo, useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Sparkles,
  Trash2,
  Save,
  FolderOpen,
  Pin,
  BookmarkPlus,
  ArrowLeftRight,
  Trash,
  CheckCircle,
  AlertTriangle,
  Wand2,
  Edit3,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Mode = "json" | "html" | "cssjs";
type ActionKind = "minify" | "prettify";

type SnippetData = {
  mode: Mode;
  action: ActionKind;
  input: string;
};

type Snippet = {
  id: string;
  name: string;
  pinned?: boolean;
  updatedAt: number;
  data: SnippetData;
};

type Preset = {
  id: string;
  name: string;
  description?: string;
  kind: "built-in" | "custom";
  data: Partial<SnippetData>;
};

const STORAGE_KEY = "tool.codeminify.snippets.v1";
const ACTIVE_KEY = "tool.codeminify.activeSnippetId.v1";
const COMPARE_KEY = "tool.codeminify.compareSnippetId.v1";
const PRESETS_KEY = "tool.codeminify.presets.v1";

function uid() {
  return Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}
function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const BUILT_IN_PRESETS: Preset[] = [
  {
    id: "p_json_prettify",
    name: "JSON • Prettify",
    description: "Parse + format JSON with indentation.",
    kind: "built-in",
    data: { mode: "json", action: "prettify" },
  },
  {
    id: "p_json_minify",
    name: "JSON • Minify",
    description: "Parse JSON and output compact form.",
    kind: "built-in",
    data: { mode: "json", action: "minify" },
  },
  {
    id: "p_html_minify",
    name: "HTML • Minify",
    description: "Collapse whitespace between tags.",
    kind: "built-in",
    data: { mode: "html", action: "minify" },
  },
  {
    id: "p_html_prettify_hint",
    name: "HTML • Clean up",
    description: "Light cleanup (whitespace only).",
    kind: "built-in",
    data: { mode: "html", action: "prettify" },
  },
  {
    id: "p_cssjs_minify",
    name: "CSS/JS • Minify",
    description: "Remove comments + whitespace (safe-ish).",
    kind: "built-in",
    data: { mode: "cssjs", action: "minify" },
  },
  {
    id: "p_cssjs_prettify_hint",
    name: "CSS/JS • Clean up",
    description: "Light cleanup (whitespace only).",
    kind: "built-in",
    data: { mode: "cssjs", action: "prettify" },
  },
];

export default function CodeMinifyTools() {
  const { toast } = useToast();

  // Core controls
  const [mode, setMode] = useState<Mode>("json");
  const [action, setAction] = useState<ActionKind>("prettify");
  const [input, setInput] = useState("");

  // Moat: snippets + compare
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [activeSnippetId, setActiveSnippetId] = useState<string>("");
  const [compareSnippetId, setCompareSnippetId] = useState<string>("");

  // Moat: presets
  const [customPresets, setCustomPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  // Options
  const [indentSize, setIndentSize] = useState<string>("2");
  const [trimTrailingSpaces, setTrimTrailingSpaces] = useState(true);
  const [removeLineComments, setRemoveLineComments] = useState(true);
  const [removeBlockComments, setRemoveBlockComments] = useState(true);

  // Premium dialogs
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [deletePresetDialogOpen, setDeletePresetDialogOpen] = useState(false);

  const [draftName, setDraftName] = useState("");
  const [draftPresetName, setDraftPresetName] = useState("");
  const [presetToDeleteId, setPresetToDeleteId] = useState<string>("");

  const allPresets = useMemo(() => [...BUILT_IN_PRESETS, ...customPresets], [customPresets]);

  // ---- Load / Persist
  useEffect(() => {
    const storedSnips = safeParse<Snippet[]>(localStorage.getItem(STORAGE_KEY), []);
    const storedActive = localStorage.getItem(ACTIVE_KEY) || "";
    const storedCompare = localStorage.getItem(COMPARE_KEY) || "";
    const storedPresets = safeParse<Preset[]>(localStorage.getItem(PRESETS_KEY), []);
    setCustomPresets(storedPresets);

    if (storedSnips.length === 0) {
      const id = uid();
      const base: Snippet = {
        id,
        name: "Untitled",
        pinned: true,
        updatedAt: Date.now(),
        data: { mode: "json", action: "prettify", input: "" },
      };
      setSnippets([base]);
      setActiveSnippetId(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([base]));
      localStorage.setItem(ACTIVE_KEY, id);
      return;
    }

    setSnippets(storedSnips);
    const defaultActive =
      storedActive && storedSnips.some((s) => s.id === storedActive) ? storedActive : storedSnips[0].id;
    setActiveSnippetId(defaultActive);
    localStorage.setItem(ACTIVE_KEY, defaultActive);

    if (storedCompare && storedSnips.some((s) => s.id === storedCompare)) setCompareSnippetId(storedCompare);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
  }, [snippets]);

  useEffect(() => {
    if (activeSnippetId) localStorage.setItem(ACTIVE_KEY, activeSnippetId);
  }, [activeSnippetId]);

  useEffect(() => {
    if (compareSnippetId) localStorage.setItem(COMPARE_KEY, compareSnippetId);
    else localStorage.removeItem(COMPARE_KEY);
  }, [compareSnippetId]);

  useEffect(() => {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(customPresets));
  }, [customPresets]);

  const activeSnippet = snippets.find((s) => s.id === activeSnippetId);

  // Apply active snippet into editor
  useEffect(() => {
    const s = snippets.find((x) => x.id === activeSnippetId);
    if (!s) return;
    setMode(s.data.mode);
    setAction(s.data.action);
    setInput(s.data.input);
  }, [activeSnippetId, snippets]);

  // Auto-save editor into active snippet
  useEffect(() => {
    const s = snippets.find((x) => x.id === activeSnippetId);
    if (!s) return;
    const next: Snippet = {
      ...s,
      updatedAt: Date.now(),
      data: { mode, action, input },
    };
    setSnippets((prev) => prev.map((p) => (p.id === activeSnippetId ? next : p)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, action, input]);

  const orderedSnippets = useMemo(() => {
    return [...snippets].sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (bp !== ap) return bp - ap;
      return b.updatedAt - a.updatedAt;
    });
  }, [snippets]);

  const normalizeInput = (txt: string) => {
    let t = txt;
    if (trimTrailingSpaces) t = t.replace(/[ \t]+$/gm, "");
    return t;
  };

  const output = useMemo(() => {
    if (!input.trim()) return "";
    const src = normalizeInput(input);

    try {
      // JSON: accurate parse/format
      if (mode === "json") {
        const obj = JSON.parse(src);
        if (action === "minify") return JSON.stringify(obj);
        const n = Math.min(8, Math.max(0, parseInt(indentSize || "2", 10) || 2));
        return JSON.stringify(obj, null, n);
      }

      // HTML
      if (mode === "html") {
        if (action === "prettify") {
          // Not a real formatter; do a gentle cleanup.
          return src.replace(/\s{2,}/g, " ").trim();
        }
        return src
          .replace(/>\s+</g, "><")
          .replace(/\s{2,}/g, " ")
          .trim();
      }

      // CSS/JS
      let t = src;
      if (removeBlockComments) t = t.replace(/\/\*[\s\S]*?\*\//g, "");
      if (removeLineComments) t = t.replace(/\/\/.*$/gm, "");
      if (action === "prettify") {
        // Gentle cleanup (not a formatter)
        return t.replace(/\s{2,}/g, " ").trim();
      }
      // Minify (safe-ish)
      return t
        .replace(/\s{2,}/g, " ")
        .replace(/\s*([{};,:()=+\-*/<>])\s*/g, "$1")
        .trim();
    } catch (e: any) {
      return `⚠️ Error: ${e?.message ? String(e.message) : "Invalid input"}`;
    }
  }, [input, mode, action, indentSize, trimTrailingSpaces, removeLineComments, removeBlockComments]);

  const isError = output.startsWith("⚠️ Error:");
  const inChars = input.length;
  const outChars = output.length;
  const savings = useMemo(() => {
    if (!input.trim() || isError) return null;
    const diff = inChars - outChars;
    const pct = inChars > 0 ? (diff / inChars) * 100 : 0;
    return { diff, pct };
  }, [inChars, outChars, input, isError]);

  const compareOutput = useMemo(() => {
    if (!compareSnippetId) return null;
    const s = snippets.find((x) => x.id === compareSnippetId);
    if (!s) return null;
    // Use same options but compare data's input/mode/action (that's the point)
    const tmpMode = s.data.mode;
    const tmpAction = s.data.action;
    const tmpInput = normalizeInput(s.data.input);

    try {
      if (!tmpInput.trim()) return { name: s.name, output: "", isError: false };
      if (tmpMode === "json") {
        const obj = JSON.parse(tmpInput);
        const out =
          tmpAction === "minify"
            ? JSON.stringify(obj)
            : JSON.stringify(obj, null, Math.min(8, Math.max(0, parseInt(indentSize || "2", 10) || 2)));
        return { name: s.name, output: out, isError: false };
      }
      if (tmpMode === "html") {
        const out =
          tmpAction === "prettify"
            ? tmpInput.replace(/\s{2,}/g, " ").trim()
            : tmpInput
                .replace(/>\s+</g, "><")
                .replace(/\s{2,}/g, " ")
                .trim();
        return { name: s.name, output: out, isError: false };
      }
      let t = tmpInput;
      if (removeBlockComments) t = t.replace(/\/\*[\s\S]*?\*\//g, "");
      if (removeLineComments) t = t.replace(/\/\/.*$/gm, "");
      const out =
        tmpAction === "prettify"
          ? t.replace(/\s{2,}/g, " ").trim()
          : t
              .replace(/\s{2,}/g, " ")
              .replace(/\s*([{};,:()=+\-*/<>])\s*/g, "$1")
              .trim();
      return { name: s.name, output: out, isError: false };
    } catch (e: any) {
      return {
        name: s.name,
        output: `⚠️ Error: ${e?.message ? String(e.message) : "Invalid input"}`,
        isError: true,
      };
    }
  }, [compareSnippetId, snippets, indentSize, trimTrailingSpaces, removeLineComments, removeBlockComments]);

  const copyOut = async () => {
    if (!output || isError) return;
    await navigator.clipboard.writeText(output);
    toast({ title: "Copied", description: "Output copied to clipboard." });
  };

  const clearAll = () => setInput("");

  // ---- Premium actions (Snippets)
  const openSaveAsNew = () => {
    const base = activeSnippet?.name ? `${activeSnippet.name} (copy)` : "New snippet";
    setDraftName(base);
    setSaveDialogOpen(true);
  };

  const confirmSaveAsNew = () => {
    const name = draftName.trim();
    if (!name) return toast({ title: "Missing name", description: "Please enter a snippet name." });

    const next: Snippet = {
      id: uid(),
      name,
      pinned: false,
      updatedAt: Date.now(),
      data: { mode, action, input },
    };

    setSnippets((prev) => [next, ...prev]);
    setActiveSnippetId(next.id);
    setSaveDialogOpen(false);
    toast({ title: "Saved", description: "Snippet saved." });
  };

  const openRename = () => {
    if (!activeSnippet) return;
    setDraftName(activeSnippet.name);
    setRenameDialogOpen(true);
  };

  const confirmRename = () => {
    if (!activeSnippet) return;
    const name = draftName.trim();
    if (!name) return toast({ title: "Missing name", description: "Please enter a snippet name." });
    setSnippets((prev) => prev.map((s) => (s.id === activeSnippet.id ? { ...s, name, updatedAt: Date.now() } : s)));
    setRenameDialogOpen(false);
    toast({ title: "Renamed", description: "Snippet renamed." });
  };

  const togglePin = () => {
    if (!activeSnippet) return;
    setSnippets((prev) =>
      prev.map((s) => (s.id === activeSnippet.id ? { ...s, pinned: !s.pinned, updatedAt: Date.now() } : s)),
    );
  };

  const openDelete = () => {
    if (!activeSnippet) return;
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!activeSnippet) return;
    if (snippets.length <= 1) {
      toast({ title: "Cannot delete", description: "You need at least 1 snippet." });
      setDeleteDialogOpen(false);
      return;
    }
    const remaining = snippets.filter((s) => s.id !== activeSnippet.id);
    setSnippets(remaining);
    setActiveSnippetId(remaining[0].id);
    if (compareSnippetId === activeSnippet.id) setCompareSnippetId("");
    setDeleteDialogOpen(false);
    toast({ title: "Deleted", description: "Snippet deleted." });
  };

  // ---- Presets
  const applyPreset = (presetId: string) => {
    const preset = allPresets.find((p) => p.id === presetId);
    if (!preset) return;

    const d = preset.data;
    if (d.mode) setMode(d.mode);
    if (d.action) setAction(d.action);

    toast({ title: "Preset applied", description: preset.name });
  };

  const openSavePreset = () => {
    setDraftPresetName(activeSnippet?.name ? `${activeSnippet.name} preset` : "My preset");
    setSavePresetDialogOpen(true);
  };

  const confirmSavePreset = () => {
    const name = draftPresetName.trim();
    if (!name) return toast({ title: "Missing name", description: "Please enter a preset name." });

    const next: Preset = {
      id: uid(),
      name,
      description: "Saved from your current settings.",
      kind: "custom",
      data: { mode, action },
    };

    setCustomPresets((prev) => [next, ...prev]);
    setSavePresetDialogOpen(false);
    setSelectedPresetId(next.id);
    toast({ title: "Preset saved", description: "You can apply it anytime." });
  };

  const requestDeletePreset = (presetId: string) => {
    const p = allPresets.find((x) => x.id === presetId);
    if (!p || p.kind !== "custom") return;
    setPresetToDeleteId(presetId);
    setDeletePresetDialogOpen(true);
  };

  const confirmDeletePreset = () => {
    const id = presetToDeleteId;
    if (!id) return;
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
    if (selectedPresetId === id) setSelectedPresetId("");
    setPresetToDeleteId("");
    setDeletePresetDialogOpen(false);
    toast({ title: "Preset deleted", description: "Removed from this browser." });
  };

  const resetOptionsForMode = () => {
    setIndentSize("2");
    setTrimTrailingSpaces(true);
    setRemoveLineComments(true);
    setRemoveBlockComments(true);
    toast({ title: "Options reset", description: "Back to safe defaults." });
  };

  return (
    <ToolLayout
      title="Minify & Prettify"
      description="Snippets + presets + compare. Lightweight format/minify for JSON/HTML/CSS/JS."
    >
      {/* Moat Toolbar - IMPROVED UX */}
      <div className="mb-6 bg-surface-elevated rounded-xl border border-border p-4">
        {/* Main toolbar row */}
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Left: Snippet management */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            {/* Snippet selector + actions */}
            <div className="flex items-end gap-2 flex-1 min-w-0">
              <div className="flex flex-col flex-1 min-w-0">
                <Label className="mb-1.5 text-xs text-muted-foreground font-medium">Snippet</Label>
                <Select value={activeSnippetId} onValueChange={setActiveSnippetId}>
                  <SelectTrigger className="h-10 px-3">
                    <SelectValue placeholder="Select snippet" />
                  </SelectTrigger>
                  <SelectContent>
                    {orderedSnippets.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.pinned ? "📌 " : ""}
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Snippet action icons */}
              <div className="flex items-center gap-0.5 pb-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={openRename}
                  disabled={!activeSnippet}
                  title="Rename snippet"
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={togglePin}
                  disabled={!activeSnippet}
                  title={activeSnippet?.pinned ? "Unpin snippet" : "Pin snippet"}
                >
                  <Pin className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 hover:text-destructive hover:bg-destructive/10"
                  onClick={openDelete}
                  disabled={!activeSnippet}
                  title="Delete snippet"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Save as new button */}
            <div className="flex items-end">
              <Button onClick={openSaveAsNew} className="h-10 px-4 w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" /> Save as new
              </Button>
            </div>
          </div>

          {/* Divider (hidden on mobile) */}
          <div className="hidden xl:block w-px bg-border self-stretch" />

          {/* Middle: Compare */}
          <div className="flex items-end gap-2 min-w-0 xl:w-64">
            <div className="flex flex-col flex-1 min-w-0">
              <Label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Compare
              </Label>
              <Select
                value={compareSnippetId || "none"}
                onValueChange={(v) => setCompareSnippetId(v === "none" ? "" : v)}
              >
                <SelectTrigger className="h-10 px-3">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {orderedSnippets
                    .filter((s) => s.id !== activeSnippetId)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.pinned ? "📌 " : ""}
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Divider (hidden on mobile) */}
          <div className="hidden xl:block w-px bg-border self-stretch" />

          {/* Right: Presets */}
          <div className="flex items-end gap-2 min-w-0 xl:w-72">
            <div className="flex flex-col flex-1 min-w-0">
              <Label className="mb-1.5 text-xs text-muted-foreground font-medium">Presets</Label>
              <Select
                value={selectedPresetId}
                onValueChange={(val) => {
                  setSelectedPresetId(val);
                  if (val) applyPreset(val);
                }}
              >
                <SelectTrigger className="h-10 px-3">
                  <SelectValue placeholder="Choose preset" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Built-in</div>
                  {BUILT_IN_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs text-muted-foreground mt-1">Your presets</div>
                  {customPresets.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No saved presets yet</div>
                  ) : (
                    customPresets.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Preset actions */}
            <div className="flex items-center gap-0.5 pb-0.5">
              <Button
                variant="secondary"
                size="icon"
                className="h-10 w-10"
                onClick={openSavePreset}
                title="Save current settings as preset"
              >
                <BookmarkPlus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => requestDeletePreset(selectedPresetId)}
                disabled={!selectedPresetId || !customPresets.some((p) => p.id === selectedPresetId)}
                title="Delete selected preset"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Compare stats (only when active) */}
        {compareOutput && (
          <>
            <div className="my-4 border-t border-border" />
            <div className="flex flex-wrap gap-3">
              <div className="rounded-lg p-2.5 bg-muted/40 border border-border flex-1 min-w-[110px]">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Current</p>
                <p className="font-semibold text-sm mt-0.5">{outChars.toLocaleString()}</p>
              </div>
              <div className="rounded-lg p-2.5 bg-muted/40 border border-border flex-1 min-w-[110px]">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Compare</p>
                <p className="font-semibold text-sm mt-0.5">{compareOutput.output.length.toLocaleString()}</p>
              </div>
              <div className="rounded-lg p-2.5 bg-muted/40 border border-border flex-1 min-w-[110px]">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Difference</p>
                <p className="font-semibold text-sm mt-0.5">
                  {(outChars - compareOutput.output.length).toLocaleString()} chars
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left */}
        <div className="space-y-6">
          <Card className="p-6">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="w-full">
                <TabsTrigger className="flex-1" value="json">
                  JSON
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="html">
                  HTML
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="cssjs">
                  CSS/JS
                </TabsTrigger>
              </TabsList>

              <TabsContent value={mode} className="mt-6 space-y-4">
                {/* Action toggle */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Mode</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${action === "prettify" ? "text-foreground" : "text-muted-foreground"}`}>
                      Prettify
                    </span>
                    <Switch
                      checked={action === "minify"}
                      onCheckedChange={(v) => setAction(v ? "minify" : "prettify")}
                    />
                    <span className={`text-sm ${action === "minify" ? "text-foreground" : "text-muted-foreground"}`}>
                      Minify
                    </span>
                  </div>
                </div>

                {/* Options */}
                <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Options</p>
                    <Button variant="ghost" size="sm" onClick={resetOptionsForMode}>
                      Reset
                    </Button>
                  </div>

                  {mode === "json" && action === "prettify" && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Indent</Label>
                        <Select value={indentSize} onValueChange={setIndentSize}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2">2 spaces</SelectItem>
                            <SelectItem value="4">4 spaces</SelectItem>
                            <SelectItem value="8">8 spaces</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
                        <div>
                          <p className="text-sm font-medium">Trim trailing spaces</p>
                          <p className="text-xs text-muted-foreground">Removes whitespace at end of lines</p>
                        </div>
                        <Switch checked={trimTrailingSpaces} onCheckedChange={setTrimTrailingSpaces} />
                      </div>
                    </div>
                  )}

                  {mode !== "json" && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
                        <div>
                          <p className="text-sm font-medium">Trim trailing spaces</p>
                          <p className="text-xs text-muted-foreground">Safer output</p>
                        </div>
                        <Switch checked={trimTrailingSpaces} onCheckedChange={setTrimTrailingSpaces} />
                      </div>

                      {mode === "cssjs" && (
                        <>
                          <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
                            <div>
                              <p className="text-sm font-medium">Remove line comments</p>
                              <p className="text-xs text-muted-foreground">// ...</p>
                            </div>
                            <Switch checked={removeLineComments} onCheckedChange={setRemoveLineComments} />
                          </div>
                          <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
                            <div>
                              <p className="text-sm font-medium">Remove block comments</p>
                              <p className="text-xs text-muted-foreground">/* ... */</p>
                            </div>
                            <Switch checked={removeBlockComments} onCheckedChange={setRemoveBlockComments} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Editor */}
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    mode === "json"
                      ? `Paste JSON here...`
                      : mode === "html"
                        ? `Paste HTML here...`
                        : `Paste CSS or JS here...`
                  }
                  className="min-h-[260px]"
                />

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="secondary"
                    onClick={copyOut}
                    disabled={!output || isError}
                    className="sm:w-auto w-full"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Output
                  </Button>
                  <Button variant="ghost" onClick={clearAll} disabled={!input} className="sm:w-auto w-full">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>

                  <div className="sm:ml-auto text-xs text-muted-foreground flex items-center gap-2 justify-between sm:justify-end">
                    <Sparkles className="h-4 w-4" />
                    <span>
                      {mode.toUpperCase()} • {action === "prettify" ? "Prettify" : "Minify"}
                    </span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Right */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold mb-1">Output</h3>
                <div className="text-xs text-muted-foreground">
                  {input.trim() && !isError ? (
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      {savings
                        ? `Saved ${Math.max(0, savings.diff).toLocaleString()} chars (${Math.max(
                            0,
                            savings.pct,
                          ).toFixed(1)}%)`
                        : "Ready"}
                    </span>
                  ) : isError ? (
                    <span className="inline-flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      Error
                    </span>
                  ) : (
                    "Paste input to see output"
                  )}
                </div>
              </div>

              <div className="text-xs text-muted-foreground text-right">
                <div>In: {inChars.toLocaleString()} chars</div>
                <div>Out: {outChars.toLocaleString()} chars</div>
              </div>
            </div>

            <pre
              className={`mt-4 rounded-md border p-4 text-sm overflow-auto min-h-[260px] ${
                isError ? "text-destructive" : ""
              }`}
            >
              {output || "Paste input to see output..."}
            </pre>

            {compareOutput && (
              <div className="mt-4 rounded-lg border p-4 bg-muted/30">
                <p className="text-sm font-medium flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" /> Compare vs "{compareOutput.name}"
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Current output: {outChars.toLocaleString()} chars • Compare output:{" "}
                  {compareOutput.output.length.toLocaleString()} chars
                </p>
              </div>
            )}
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• JSON uses real parsing (accurate).</li>
              <li>• HTML/CSS/JS are lightweight minify/cleanup (not a full formatter).</li>
              <li>• For complex JS, use a bundler formatter (Prettier / Terser) in production.</li>
            </ul>
          </Card>
        </div>
      </div>

      {/* -------- Premium Dialogs -------- */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as new snippet</DialogTitle>
            <DialogDescription>Create a copy you can reuse or compare later.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="snippetNameSave">Snippet name</Label>
            <Input
              id="snippetNameSave"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="e.g. API response (minified)"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSaveAsNew}>
              <Save className="h-4 w-4 mr-2" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename snippet</DialogTitle>
            <DialogDescription>Give this snippet a clearer name for later.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="snippetNameRename">Snippet name</Label>
            <Input
              id="snippetNameRename"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Snippet name"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRename}>
              <FolderOpen className="h-4 w-4 mr-2" /> Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this snippet?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-medium">{activeSnippet?.name ?? "this snippet"}</span>.
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={savePresetDialogOpen} onOpenChange={setSavePresetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save a preset</DialogTitle>
            <DialogDescription>Presets save your preferred mode + action.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="presetName">Preset name</Label>
            <Input
              id="presetName"
              value={draftPresetName}
              onChange={(e) => setDraftPresetName(e.target.value)}
              placeholder="e.g. JSON minify default"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSavePresetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSavePreset}>
              <BookmarkPlus className="h-4 w-4 mr-2" /> Save preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletePresetDialogOpen} onOpenChange={setDeletePresetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this preset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected custom preset from your browser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePreset}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ToolLayout>
  );
}
