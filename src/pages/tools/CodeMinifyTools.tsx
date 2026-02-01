import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  Download,
  Upload,
  FileText,
  Search,
  Tag,
  Folder,
  FolderPlus,
  Wrench,
  SortAsc,
  Minimize2,
  Code2,
  FileCode,
  Clipboard,
  Shield,
  Zap,
  Eye,
  ChevronRight,
  ChevronDown,
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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  tags?: string[];
  folderId?: string;
};

type Preset = {
  id: string;
  name: string;
  description?: string;
  kind: "built-in" | "custom";
  data: Partial<SnippetData>;
};

type SnippetFolder = {
  id: string;
  name: string;
  color?: string;
};

type DiffStats = {
  charsRemoved: number;
  percentReduced: number;
  commentsRemoved: number;
  whitespaceRuns: number;
};

const STORAGE_KEY = "tool.codeminify.snippets.v1";
const ACTIVE_KEY = "tool.codeminify.activeSnippetId.v1";
const COMPARE_KEY = "tool.codeminify.compareSnippetId.v1";
const PRESETS_KEY = "tool.codeminify.presets.v1";
const FOLDERS_KEY = "tool.codeminify.folders.v1";

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

const SAMPLE_TEMPLATES = {
  json: `{
  "user": {
    "id": 12345,
    "name": "John Doe",
    "email": "john@example.com",
    "active": true,
    "roles": ["admin", "user"],
    "metadata": {
      "lastLogin": "2024-01-15T10:30:00Z",
      "loginCount": 42
    }
  }
}`,
  html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sample Page</title>
</head>
<body>
    <header>
        <h1>Welcome</h1>
    </header>
    <main>
        <p>This is a sample HTML snippet.</p>
    </main>
</body>
</html>`,
  cssjs: `function calculateTotal(items) {
  // Calculate the sum
  return items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);
}

/* Styles */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}`,
};

export default function CodeMinifyTools() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Core controls
  const [mode, setMode] = useState<Mode>("json");
  const [action, setAction] = useState<ActionKind>("prettify");
  const [input, setInput] = useState("");

  // Moat: snippets + compare
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [activeSnippetId, setActiveSnippetId] = useState<string>("");
  const [compareSnippetId, setCompareSnippetId] = useState<string>("");

  // Folders & Search
  const [folders, setFolders] = useState<SnippetFolder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["all"]));

  // Moat: presets
  const [customPresets, setCustomPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  // Options
  const [indentSize, setIndentSize] = useState<string>("2");
  const [trimTrailingSpaces, setTrimTrailingSpaces] = useState(true);
  const [removeLineComments, setRemoveLineComments] = useState(true);
  const [removeBlockComments, setRemoveBlockComments] = useState(true);

  // NEW: Safety mode for JS/CSS
  const [safetyMode, setSafetyMode] = useState<"safe" | "aggressive">("safe");

  // NEW: JSON power features
  const [jsonSortKeys, setJsonSortKeys] = useState(false);
  const [jsonRemoveEmpty, setJsonRemoveEmpty] = useState(false);

  // NEW: JSON fixer
  const [autoFixJson, setAutoFixJson] = useState(false);

  // NEW: Diff view
  const [showDiff, setShowDiff] = useState(false);

  // Premium dialogs
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [deletePresetDialogOpen, setDeletePresetDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [manageFoldersOpen, setManageFoldersOpen] = useState(false);

  const [draftName, setDraftName] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [draftFolderId, setDraftFolderId] = useState<string>("");
  const [draftPresetName, setDraftPresetName] = useState("");
  const [presetToDeleteId, setPresetToDeleteId] = useState<string>("");
  const [draftFolderName, setDraftFolderName] = useState("");
  const [folderToDeleteId, setFolderToDeleteId] = useState<string>("");

  const allPresets = useMemo(() => [...BUILT_IN_PRESETS, ...customPresets], [customPresets]);

  // ---- Load / Persist
  useEffect(() => {
    const storedSnips = safeParse<Snippet[]>(localStorage.getItem(STORAGE_KEY), []);
    const storedActive = localStorage.getItem(ACTIVE_KEY) || "";
    const storedCompare = localStorage.getItem(COMPARE_KEY) || "";
    const storedPresets = safeParse<Preset[]>(localStorage.getItem(PRESETS_KEY), []);
    const storedFolders = safeParse<SnippetFolder[]>(localStorage.getItem(FOLDERS_KEY), []);

    setCustomPresets(storedPresets);
    setFolders(storedFolders);

    if (storedSnips.length === 0) {
      const id = uid();
      const base: Snippet = {
        id,
        name: "Untitled",
        pinned: true,
        updatedAt: Date.now(),
        data: { mode: "json", action: "prettify", input: "" },
        tags: [],
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

  useEffect(() => {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  }, [folders]);

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

  // NEW: Filter snippets by folder and search
  const filteredSnippets = useMemo(() => {
    let result = snippets;

    // Filter by folder
    if (selectedFolderId !== "all") {
      result = result.filter((s) => s.folderId === selectedFolderId);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.tags && s.tags.some((t) => t.toLowerCase().includes(q))) ||
          s.data.input.toLowerCase().includes(q),
      );
    }

    return result;
  }, [snippets, selectedFolderId, searchQuery]);

  const orderedSnippets = useMemo(() => {
    return [...filteredSnippets].sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (bp !== ap) return bp - ap;
      return b.updatedAt - a.updatedAt;
    });
  }, [filteredSnippets]);

  const normalizeInput = (txt: string) => {
    let t = txt;
    if (trimTrailingSpaces) t = t.replace(/[ \t]+$/gm, "");
    return t;
  };

  // NEW: JSON fixer
  const fixJsonString = (str: string): string => {
    if (!autoFixJson) return str;

    let fixed = str;

    // Remove BOM
    fixed = fixed.replace(/^\uFEFF/, "");

    // Remove comments (JSONC style)
    fixed = fixed.replace(/\/\/.*$/gm, "");
    fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, "");

    // Fix trailing commas
    fixed = fixed.replace(/,(\s*[}\]])/g, "$1");

    // Fix single quotes to double quotes (simple heuristic)
    fixed = fixed.replace(/'([^']*?)'/g, '"$1"');

    // Fix unquoted keys (basic pattern)
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    return fixed;
  };

  // NEW: JSON power features processing
  const processJsonPowerFeatures = (obj: any): any => {
    if (!obj || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
      return obj.map(processJsonPowerFeatures);
    }

    let result = { ...obj };

    // Remove empty/null
    if (jsonRemoveEmpty) {
      Object.keys(result).forEach((key) => {
        const val = result[key];
        if (val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0)) {
          delete result[key];
        } else if (typeof val === "object") {
          result[key] = processJsonPowerFeatures(val);
        }
      });
    }

    // Sort keys
    if (jsonSortKeys) {
      const sorted: any = {};
      Object.keys(result)
        .sort()
        .forEach((key) => {
          sorted[key] = typeof result[key] === "object" ? processJsonPowerFeatures(result[key]) : result[key];
        });
      result = sorted;
    }

    return result;
  };

  // NEW: Enhanced HTML/CSS/JS beautify
  const beautifyHtml = (html: string): string => {
    let result = html;
    let indent = 0;
    const indentStr = " ".repeat(parseInt(indentSize || "2", 10));

    // Simple tag-based indentation
    result = result.replace(/>\s*</g, ">\n<");

    const lines = result.split("\n");
    const formatted: string[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Decrease indent for closing tags
      if (trimmed.startsWith("</")) {
        indent = Math.max(0, indent - 1);
      }

      formatted.push(indentStr.repeat(indent) + trimmed);

      // Increase indent for opening tags (not self-closing)
      if (
        trimmed.startsWith("<") &&
        !trimmed.startsWith("</") &&
        !trimmed.endsWith("/>") &&
        !trimmed.match(/<(br|hr|img|input|meta|link)/i)
      ) {
        indent++;
      }
    });

    return formatted.join("\n");
  };

  const beautifyCssJs = (code: string): string => {
    let result = code;
    const indentStr = " ".repeat(parseInt(indentSize || "2", 10));

    // Remove comments if needed
    if (removeBlockComments) result = result.replace(/\/\*[\s\S]*?\*\//g, "");
    if (removeLineComments) result = result.replace(/\/\/.*$/gm, "");

    // Add newlines after braces and semicolons
    result = result.replace(/\{/g, "{\n");
    result = result.replace(/\}/g, "\n}\n");
    result = result.replace(/;/g, ";\n");

    const lines = result.split("\n");
    const formatted: string[] = [];
    let indent = 0;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Decrease indent for closing braces
      if (trimmed.startsWith("}")) {
        indent = Math.max(0, indent - 1);
      }

      formatted.push(indentStr.repeat(indent) + trimmed);

      // Increase indent for opening braces
      if (trimmed.endsWith("{")) {
        indent++;
      }
    });

    return formatted.join("\n");
  };

  const output = useMemo(() => {
    if (!input.trim()) return "";
    let src = normalizeInput(input);

    // Apply JSON fixer if enabled
    if (mode === "json" && autoFixJson) {
      src = fixJsonString(src);
    }

    try {
      // JSON: accurate parse/format
      if (mode === "json") {
        let obj = JSON.parse(src);

        // Apply power features
        obj = processJsonPowerFeatures(obj);

        if (action === "minify") return JSON.stringify(obj);
        const n = Math.min(8, Math.max(0, parseInt(indentSize || "2", 10) || 2));
        return JSON.stringify(obj, null, n);
      }

      // HTML
      if (mode === "html") {
        if (action === "prettify") {
          return beautifyHtml(src);
        }
        return src
          .replace(/>\s+</g, "><")
          .replace(/\s{2,}/g, " ")
          .trim();
      }

      // CSS/JS
      let t = src;

      if (safetyMode === "safe") {
        // Safe mode: only whitespace
        if (action === "prettify") {
          return beautifyCssJs(t);
        }
        return t.replace(/\s{2,}/g, " ").trim();
      } else {
        // Aggressive mode
        if (removeBlockComments) t = t.replace(/\/\*[\s\S]*?\*\//g, "");
        if (removeLineComments) t = t.replace(/\/\/.*$/gm, "");
        if (action === "prettify") {
          return beautifyCssJs(t);
        }
        return t
          .replace(/\s{2,}/g, " ")
          .replace(/\s*([{};,:()=+\-*/<>])\s*/g, "$1")
          .trim();
      }
    } catch (e: any) {
      return `⚠️ Error: ${e?.message ? String(e.message) : "Invalid input"}`;
    }
  }, [
    input,
    mode,
    action,
    indentSize,
    trimTrailingSpaces,
    removeLineComments,
    removeBlockComments,
    safetyMode,
    autoFixJson,
    jsonSortKeys,
    jsonRemoveEmpty,
  ]);

  const isError = output.startsWith("⚠️ Error:");
  const inChars = input.length;
  const outChars = output.length;

  // NEW: Enhanced diff stats
  const diffStats = useMemo((): DiffStats | null => {
    if (!input.trim() || isError) return null;

    const diff = inChars - outChars;
    const pct = inChars > 0 ? (diff / inChars) * 100 : 0;

    // Count comments removed
    const lineComments = (input.match(/\/\/.*/g) || []).length;
    const blockComments = (input.match(/\/\*[\s\S]*?\*\//g) || []).length;
    const commentsRemoved = lineComments + blockComments;

    // Count whitespace runs collapsed
    const whitespaceRuns = (input.match(/\s{2,}/g) || []).length;

    return {
      charsRemoved: Math.max(0, diff),
      percentReduced: Math.max(0, pct),
      commentsRemoved,
      whitespaceRuns,
    };
  }, [inChars, outChars, input, isError]);

  const compareOutput = useMemo(() => {
    if (!compareSnippetId) return null;
    const s = snippets.find((x) => x.id === compareSnippetId);
    if (!s) return null;
    const tmpMode = s.data.mode;
    const tmpAction = s.data.action;
    let tmpInput = normalizeInput(s.data.input);

    if (tmpMode === "json" && autoFixJson) {
      tmpInput = fixJsonString(tmpInput);
    }

    try {
      if (!tmpInput.trim()) return { name: s.name, output: "", isError: false };
      if (tmpMode === "json") {
        let obj = JSON.parse(tmpInput);
        obj = processJsonPowerFeatures(obj);
        const out =
          tmpAction === "minify"
            ? JSON.stringify(obj)
            : JSON.stringify(obj, null, Math.min(8, Math.max(0, parseInt(indentSize || "2", 10) || 2)));
        return { name: s.name, output: out, isError: false };
      }
      if (tmpMode === "html") {
        const out =
          tmpAction === "prettify"
            ? beautifyHtml(tmpInput)
            : tmpInput
                .replace(/>\s+</g, "><")
                .replace(/\s{2,}/g, " ")
                .trim();
        return { name: s.name, output: out, isError: false };
      }
      let t = tmpInput;
      if (safetyMode === "aggressive") {
        if (removeBlockComments) t = t.replace(/\/\*[\s\S]*?\*\//g, "");
        if (removeLineComments) t = t.replace(/\/\/.*$/gm, "");
      }
      const out =
        tmpAction === "prettify"
          ? beautifyCssJs(t)
          : safetyMode === "safe"
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
  }, [
    compareSnippetId,
    snippets,
    indentSize,
    trimTrailingSpaces,
    removeLineComments,
    removeBlockComments,
    safetyMode,
    autoFixJson,
    jsonSortKeys,
    jsonRemoveEmpty,
  ]);

  const copyOut = async () => {
    if (!output || isError) return;
    await navigator.clipboard.writeText(output);
    toast({ title: "Copied", description: "Output copied to clipboard." });
  };

  // NEW: Paste from clipboard
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
      toast({ title: "Pasted", description: "Content pasted from clipboard." });
    } catch (err) {
      toast({
        title: "Error",
        description: "Could not read clipboard. Please paste manually.",
        variant: "destructive",
      });
    }
  };

  // NEW: Export functionality
  const exportAsFile = () => {
    if (!output || isError) return;

    const extensions: Record<Mode, string> = {
      json: mode === "json" ? ".json" : ".txt",
      html: ".html",
      cssjs: action === "minify" ? ".min.js" : ".js",
    };

    const filename = `${activeSnippet?.name || "export"}${extensions[mode]}`;
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "Downloaded", description: `Saved as ${filename}` });
  };

  // NEW: Drag and drop file
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setInput(text);
        toast({ title: "File loaded", description: file.name });
      };
      reader.readAsText(file);
    },
    [toast],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setInput(text);
      toast({ title: "File loaded", description: file.name });
    };
    reader.readAsText(file);
  };

  // NEW: Insert template
  const insertTemplate = () => {
    setInput(SAMPLE_TEMPLATES[mode]);
    toast({ title: "Template inserted", description: "Sample code loaded." });
  };

  const clearAll = () => setInput("");

  // NEW: Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter: Run (auto-processes already, so just focus output)
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (output && !isError) {
          toast({ title: "Processed", description: "Output ready!" });
        }
      }

      // Cmd/Ctrl + Shift + C: Copy output
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "c") {
        e.preventDefault();
        copyOut();
      }

      // Cmd/Ctrl + K: Clear
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        clearAll();
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [output, isError]);

  // ---- Premium actions (Snippets)
  const openSaveAsNew = () => {
    const base = activeSnippet?.name ? `${activeSnippet.name} (copy)` : "New snippet";
    setDraftName(base);
    setDraftTags(activeSnippet?.tags?.join(", ") || "");
    setDraftFolderId(activeSnippet?.folderId || "");
    setSaveDialogOpen(true);
  };

  const confirmSaveAsNew = () => {
    const name = draftName.trim();
    if (!name) return toast({ title: "Missing name", description: "Please enter a snippet name." });

    const tags = draftTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const next: Snippet = {
      id: uid(),
      name,
      pinned: false,
      updatedAt: Date.now(),
      data: { mode, action, input },
      tags,
      folderId: draftFolderId || undefined,
    };

    setSnippets((prev) => [next, ...prev]);
    setActiveSnippetId(next.id);
    setSaveDialogOpen(false);
    toast({ title: "Saved", description: "Snippet saved." });
  };

  const openRename = () => {
    if (!activeSnippet) return;
    setDraftName(activeSnippet.name);
    setDraftTags(activeSnippet.tags?.join(", ") || "");
    setDraftFolderId(activeSnippet.folderId || "");
    setRenameDialogOpen(true);
  };

  const confirmRename = () => {
    if (!activeSnippet) return;
    const name = draftName.trim();
    if (!name) return toast({ title: "Missing name", description: "Please enter a snippet name." });

    const tags = draftTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setSnippets((prev) =>
      prev.map((s) =>
        s.id === activeSnippet.id
          ? { ...s, name, tags, folderId: draftFolderId || undefined, updatedAt: Date.now() }
          : s,
      ),
    );
    setRenameDialogOpen(false);
    toast({ title: "Updated", description: "Snippet updated." });
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

  // NEW: Folder management
  const createFolder = () => {
    setDraftFolderName("");
    setFolderDialogOpen(true);
  };

  const confirmCreateFolder = () => {
    const name = draftFolderName.trim();
    if (!name) return toast({ title: "Missing name", description: "Please enter a folder name." });

    const next: SnippetFolder = {
      id: uid(),
      name,
    };

    setFolders((prev) => [...prev, next]);
    setFolderDialogOpen(false);
    toast({ title: "Folder created", description: name });
  };

  const deleteFolder = (folderId: string) => {
    // Move snippets out of folder
    setSnippets((prev) => prev.map((s) => (s.folderId === folderId ? { ...s, folderId: undefined } : s)));
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    if (selectedFolderId === folderId) setSelectedFolderId("all");
    toast({ title: "Folder deleted", description: "Snippets moved to root." });
  };

  const toggleFolderExpansion = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const resetOptionsForMode = () => {
    setIndentSize("2");
    setTrimTrailingSpaces(true);
    setRemoveLineComments(true);
    setRemoveBlockComments(true);
    setSafetyMode("safe");
    setJsonSortKeys(false);
    setJsonRemoveEmpty(false);
    setAutoFixJson(false);
    toast({ title: "Options reset", description: "Back to safe defaults." });
  };

  // Count snippets per folder
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { all: snippets.length };
    folders.forEach((f) => {
      counts[f.id] = snippets.filter((s) => s.folderId === f.id).length;
    });
    counts["none"] = snippets.filter((s) => !s.folderId).length;
    return counts;
  }, [snippets, folders]);

  return (
    <ToolLayout
      title="Minify & Prettify"
      description="Snippets + presets + compare. Lightweight format/minify for JSON/HTML/CSS/JS."
    >
      {/* Moat Toolbar */}
      <div className="mb-6 bg-surface-elevated rounded-xl border border-border p-4">
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Left: Snippet management */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
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
                        {s.tags && s.tags.length > 0 ? ` • ${s.tags.join(", ")}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-0.5 pb-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={openRename}
                  disabled={!activeSnippet}
                  title="Edit snippet"
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

            <div className="flex items-end">
              <Button onClick={openSaveAsNew} className="h-10 px-4 w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" /> Save as new
              </Button>
            </div>
          </div>

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

        {/* Compare stats */}
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

      {/* NEW: Folder sidebar + Search */}
      <div className="grid lg:grid-cols-[280px_1fr] gap-6 mb-6">
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Library</h3>
              <Button variant="ghost" size="sm" onClick={createFolder}>
                <FolderPlus className="h-4 w-4" />
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search snippets..."
                className="pl-9 h-9"
              />
            </div>

            {/* Folder tree */}
            <div className="space-y-1">
              <button
                onClick={() => {
                  setSelectedFolderId("all");
                  toggleFolderExpansion("all");
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                  selectedFolderId === "all" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
              >
                {expandedFolders.has("all") ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Folder className="h-4 w-4" />
                <span className="flex-1 text-left">All Snippets</span>
                <span className="text-xs text-muted-foreground">{folderCounts.all}</span>
              </button>

              {folders.map((folder) => (
                <div key={folder.id}>
                  <button
                    onClick={() => {
                      setSelectedFolderId(folder.id);
                      toggleFolderExpansion(folder.id);
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                      selectedFolderId === folder.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    }`}
                  >
                    {expandedFolders.has(folder.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <Folder className="h-4 w-4" />
                    <span className="flex-1 text-left">{folder.name}</span>
                    <span className="text-xs text-muted-foreground">{folderCounts[folder.id] || 0}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFolder(folder.id);
                      }}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Keyboard shortcuts card */}
        <Card className="p-4 bg-muted/50">
          <h3 className="font-semibold text-sm mb-3">Keyboard Shortcuts</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-background border">⌘/Ctrl</kbd>
              <kbd className="px-2 py-1 rounded bg-background border">⇧</kbd>
              <kbd className="px-2 py-1 rounded bg-background border">C</kbd>
              <span className="text-muted-foreground">Copy output</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-background border">⌘/Ctrl</kbd>
              <kbd className="px-2 py-1 rounded bg-background border">K</kbd>
              <span className="text-muted-foreground">Clear input</span>
            </div>
          </div>
        </Card>
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

                  {mode === "json" && (
                    <div className="space-y-3">
                      {/* JSON Fixer */}
                      <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
                        <div>
                          <p className="text-sm font-medium flex items-center gap-2">
                            <Wrench className="h-4 w-4" />
                            Auto-fix JSON errors
                          </p>
                          <p className="text-xs text-muted-foreground">Fix quotes, trailing commas, comments, BOM</p>
                        </div>
                        <Switch checked={autoFixJson} onCheckedChange={setAutoFixJson} />
                      </div>

                      {/* JSON Power Features */}
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
                          <div>
                            <p className="text-sm font-medium flex items-center gap-2">
                              <SortAsc className="h-4 w-4" />
                              Sort keys
                            </p>
                            <p className="text-xs text-muted-foreground">Alphabetical order</p>
                          </div>
                          <Switch checked={jsonSortKeys} onCheckedChange={setJsonSortKeys} />
                        </div>

                        <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
                          <div>
                            <p className="text-sm font-medium flex items-center gap-2">
                              <Minimize2 className="h-4 w-4" />
                              Remove empty
                            </p>
                            <p className="text-xs text-muted-foreground">null, "", []</p>
                          </div>
                          <Switch checked={jsonRemoveEmpty} onCheckedChange={setJsonRemoveEmpty} />
                        </div>
                      </div>

                      {action === "prettify" && (
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
                    </div>
                  )}

                  {mode === "html" && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {action === "prettify" && (
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
                      )}
                      <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
                        <div>
                          <p className="text-sm font-medium">Trim trailing spaces</p>
                          <p className="text-xs text-muted-foreground">Safer output</p>
                        </div>
                        <Switch checked={trimTrailingSpaces} onCheckedChange={setTrimTrailingSpaces} />
                      </div>
                    </div>
                  )}

                  {mode === "cssjs" && (
                    <div className="space-y-3">
                      {/* Safety Mode Toggle */}
                      <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
                        <div className="flex items-center gap-2">
                          {safetyMode === "safe" ? (
                            <Shield className="h-4 w-4 text-green-600" />
                          ) : (
                            <Zap className="h-4 w-4 text-orange-600" />
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {safetyMode === "safe" ? "Safe Mode" : "Aggressive Mode"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {safetyMode === "safe"
                                ? "Whitespace only (safest)"
                                : "Strip comments + aggressive minify"}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={safetyMode === "aggressive"}
                          onCheckedChange={(v) => setSafetyMode(v ? "aggressive" : "safe")}
                        />
                      </div>

                      {action === "prettify" && (
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
                      )}

                      {safetyMode === "aggressive" && (
                        <div className="grid sm:grid-cols-2 gap-3">
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
                        </div>
                      )}

                      <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
                        <div>
                          <p className="text-sm font-medium">Trim trailing spaces</p>
                          <p className="text-xs text-muted-foreground">Safer output</p>
                        </div>
                        <Switch checked={trimTrailingSpaces} onCheckedChange={setTrimTrailingSpaces} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Editor with drag-drop */}
                <div
                  className={`relative ${isDragging ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      mode === "json"
                        ? `Paste JSON here or drag & drop a file...`
                        : mode === "html"
                          ? `Paste HTML here or drag & drop a file...`
                          : `Paste CSS or JS here or drag & drop a file...`
                    }
                    className="min-h-[260px]"
                  />
                  {isDragging && (
                    <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-md flex items-center justify-center pointer-events-none">
                      <p className="text-sm font-medium">Drop file to load</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" className="sm:w-auto w-full">
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={pasteFromClipboard}>
                        <Clipboard className="h-4 w-4 mr-2" />
                        Paste from clipboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                        <FileText className="h-4 w-4 mr-2" />
                        Upload file
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={insertTemplate}>
                        <Code2 className="h-4 w-4 mr-2" />
                        Insert sample
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.html,.css,.js,.txt"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  <Button
                    variant="secondary"
                    onClick={copyOut}
                    disabled={!output || isError}
                    className="sm:w-auto w-full"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Output
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={exportAsFile}
                    disabled={!output || isError}
                    className="sm:w-auto w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
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
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-semibold mb-1">Output</h3>
                <div className="text-xs text-muted-foreground">
                  {input.trim() && !isError ? (
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Ready
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

              <div className="flex items-center gap-2">
                <Button
                  variant={showDiff ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowDiff(!showDiff)}
                  disabled={!input.trim() || isError}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {showDiff ? "Hide" : "Show"} Diff
                </Button>
              </div>
            </div>

            {/* NEW: Diff Stats Summary */}
            {diffStats && !showDiff && (
              <div className="mb-4 rounded-lg border p-3 bg-muted/30">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Removed</p>
                    <p className="text-lg font-semibold text-green-600">{diffStats.charsRemoved.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">chars</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reduction</p>
                    <p className="text-lg font-semibold text-green-600">{diffStats.percentReduced.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Comments</p>
                    <p className="text-lg font-semibold">{diffStats.commentsRemoved}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Whitespace</p>
                    <p className="text-lg font-semibold">{diffStats.whitespaceRuns}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Output display */}
            {showDiff && !isError && input.trim() ? (
              <div className="space-y-2">
                <div className="rounded-md border overflow-hidden">
                  <div className="bg-red-50 dark:bg-red-950/20 px-3 py-1 border-b text-xs font-medium text-red-600 dark:text-red-400">
                    Before ({inChars.toLocaleString()} chars)
                  </div>
                  <pre className="p-3 text-xs overflow-auto max-h-[200px]">{input}</pre>
                </div>
                <div className="rounded-md border overflow-hidden">
                  <div className="bg-green-50 dark:bg-green-950/20 px-3 py-1 border-b text-xs font-medium text-green-600 dark:text-green-400">
                    After ({outChars.toLocaleString()} chars)
                  </div>
                  <pre className="p-3 text-xs overflow-auto max-h-[200px]">{output}</pre>
                </div>
              </div>
            ) : (
              <>
                <pre
                  className={`rounded-md border p-4 text-sm overflow-auto min-h-[260px] ${
                    isError ? "text-destructive" : ""
                  }`}
                >
                  {output || "Paste input to see output..."}
                </pre>

                <div className="mt-2 text-xs text-muted-foreground text-right">
                  <div>In: {inChars.toLocaleString()} chars</div>
                  <div>Out: {outChars.toLocaleString()} chars</div>
                </div>
              </>
            )}

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
              <li>• HTML/CSS/JS beautify uses simple tag/brace-based indentation.</li>
              <li>• For production JS, use Prettier/Terser with proper AST parsing.</li>
              <li>• Safe mode (CSS/JS) only collapses whitespace - won't break code.</li>
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

          <div className="space-y-3">
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

            <div className="space-y-2">
              <Label htmlFor="snippetTags">
                <Tag className="h-3 w-3 inline mr-1" />
                Tags (comma-separated)
              </Label>
              <Input
                id="snippetTags"
                value={draftTags}
                onChange={(e) => setDraftTags(e.target.value)}
                placeholder="e.g. api, production, client-x"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="snippetFolder">
                <Folder className="h-3 w-3 inline mr-1" />
                Folder
              </Label>
              <Select value={draftFolderId} onValueChange={setDraftFolderId}>
                <SelectTrigger id="snippetFolder">
                  <SelectValue placeholder="No folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No folder</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <DialogTitle>Edit snippet</DialogTitle>
            <DialogDescription>Update name, tags, and folder.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
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

            <div className="space-y-2">
              <Label htmlFor="snippetTagsRename">
                <Tag className="h-3 w-3 inline mr-1" />
                Tags (comma-separated)
              </Label>
              <Input
                id="snippetTagsRename"
                value={draftTags}
                onChange={(e) => setDraftTags(e.target.value)}
                placeholder="e.g. api, production, client-x"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="snippetFolderRename">
                <Folder className="h-3 w-3 inline mr-1" />
                Folder
              </Label>
              <Select value={draftFolderId} onValueChange={setDraftFolderId}>
                <SelectTrigger id="snippetFolderRename">
                  <SelectValue placeholder="No folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No folder</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRename}>
              <FolderOpen className="h-4 w-4 mr-2" /> Update
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

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
            <DialogDescription>Organize your snippets into folders.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="folderName">Folder name</Label>
            <Input
              id="folderName"
              value={draftFolderName}
              onChange={(e) => setDraftFolderName(e.target.value)}
              placeholder="e.g. Work, Personal, Client Projects"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmCreateFolder}>
              <FolderPlus className="h-4 w-4 mr-2" /> Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ToolLayout>
  );
}
