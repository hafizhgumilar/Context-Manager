"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Save, LogIn } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import {
  useBuilderStore,
  type BuilderSection,
} from "@/lib/store/builder-store";
import type { TemplateCategory, SectionType } from "@/lib/section-taxonomy";
import { buildOutput } from "@/lib/output";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/hooks/use-toast";
import { measureText } from "@/lib/text-metrics";
import {
  BUILDER_COPY_COST,
  BUILDER_DOWNLOAD_COST,
  BUILDER_SAVE_COST,
} from "@/lib/economy";
import { broadcastWalletBalance } from "@/lib/events";
import { shallow } from "zustand/shallow";

type ApiSection = {
  id: string;
  type: string;
  title: string;
  orderIndex: number;
  filename: string | null;
  content: string;
};

function fallbackCopy(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const successful = document.execCommand("copy");
  document.body.removeChild(textarea);
  return successful;
}

function toBuilderSections(sections: ApiSection[]): BuilderSection[] {
  return sections
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((section) => ({
      id: section.id,
      type: section.type as SectionType,
      title: section.title,
      orderIndex: section.orderIndex,
      filename: section.filename ?? undefined,
      content: section.content,
    }));
}

function formatCoinCost(amount: number) {
  const normalized = Math.max(0, Math.abs(Math.trunc(amount)));
  const unit = normalized === 1 ? "coin" : "coins";
  return `${normalized.toLocaleString()} ${unit}`;
}

export function BuilderHeader() {
  const { toast } = useToast();
  const router = useRouter();
  const { status } = useSession();
  const name = useBuilderStore((state) => state.name);
  const setName = useBuilderStore((state) => state.setName);
  const sections = useBuilderStore(
    (state) =>
      state.sectionOrder
        .map((id) => state.sectionsById[id])
        .filter((section): section is BuilderSection => Boolean(section)),
    shallow,
  );
  const category = useBuilderStore((state) => state.category);
  const templateId = useBuilderStore((state) => state.templateId);
  const dirty = useBuilderStore((state) => state.dirty);
  const markClean = useBuilderStore((state) => state.markClean);
  const hydrateFromTemplate = useBuilderStore(
    (state) => state.hydrateFromTemplate,
  );
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);

  const output = useMemo(() => buildOutput(sections), [sections]);
  const totalMetrics = useMemo(() => measureText(output), [output]);
  const isAuthenticated = status === "authenticated";
  const builderCosts = useMemo(
    () => ({
      save: Math.max(0, Math.abs(BUILDER_SAVE_COST)),
      copy: Math.max(0, Math.abs(BUILDER_COPY_COST)),
      download: Math.max(0, Math.abs(BUILDER_DOWNLOAD_COST)),
    }),
    [],
  );

  const attemptSpend = useCallback(
    async (
      action: "builder_copy" | "builder_download" | "builder_save",
      cost: number,
    ): Promise<{ success: boolean }> => {
      const normalizedCost = Math.max(0, Math.abs(Math.trunc(cost)));
      if (normalizedCost <= 0) {
        return { success: true };
      }

      try {
        const response = await fetch("/api/wallet/spend", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        });

        if (response.ok) {
          const data = await response.json().catch(() => null);
          const balance =
            data && typeof data.balance === "number" ? data.balance : null;

          if (typeof balance === "number") {
            broadcastWalletBalance(balance);
          }

          return { success: true };
        }

        if (response.status === 401) {
          toast({
            title: "Sign in required",
            description: "Sign in to spend coins on builder features.",
          });
          return { success: false };
        }

        if (response.status === 402) {
          const data = await response.json().catch(() => null);
          toast({
            title: "Not enough coins",
            description:
              data?.error ??
              "You need more coins to use this feature. Visit the wallet to top up.",
            variant: "destructive",
          });
          return { success: false };
        }

        const data = await response.json().catch(() => null);
        toast({
          title: "Unable to spend coins",
          description: data?.error ?? "Please try again in a moment.",
          variant: "destructive",
        });
        return { success: false };
      } catch (error) {
        console.error(error);
        toast({
          title: "Unable to spend coins",
          description: "Please check your connection and try again.",
          variant: "destructive",
        });
        return { success: false };
      }
    },
    [toast],
  );

  const handleCopy = useCallback(async () => {
    if (!output.trim()) {
      toast({
        title: "Nothing to copy yet",
        description: "Add content to at least one section before copying.",
      });
      return;
    }

    if (!isAuthenticated) {
      toast({
        title: "Sign in to copy",
        description: "Log in so we can use your wallet coins for this action.",
      });
      return;
    }

    setCopying(true);
    try {
      const spend = await attemptSpend("builder_copy", builderCosts.copy);
      if (!spend.success) {
        return;
      }

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(output);
      } else {
        fallbackCopy(output);
      }
      toast({
        title: "Context copied",
        description: "Formatted output is ready in your clipboard.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Copy failed",
        description: "We couldn't access your clipboard. Please try again.",
      });
    } finally {
      setCopying(false);
    }
  }, [attemptSpend, builderCosts.copy, isAuthenticated, output, toast]);

  const handleDownload = useCallback(async () => {
    if (!output.trim()) {
      toast({
        title: "Nothing to download yet",
        description: "Add content to at least one section before downloading.",
      });
      return;
    }

    if (!isAuthenticated) {
      toast({
        title: "Sign in to download",
        description: "Log in so we can use your wallet coins for this action.",
      });
      return;
    }

    setDownloading(true);
    try {
      const spend = await attemptSpend(
        "builder_download",
        builderCosts.download,
      );
      if (!spend.success) {
        return;
      }

      const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeName = name?.trim() ? name.trim() : "context-template";
      link.download = `${safeName.replace(/\s+/g, "-").toLowerCase()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: "Download started",
        description: "Your formatted context file is downloading.",
      });
    } finally {
      setDownloading(false);
    }
  }, [
    attemptSpend,
    builderCosts.download,
    isAuthenticated,
    name,
    output,
    toast,
  ]);

  const handleSave = useCallback(async () => {
    if (!isAuthenticated) {
      signIn(undefined, { callbackUrl: "/builder" }).catch(() => null);
      return;
    }

    const normalizedName = name.trim();
    if (!normalizedName) {
      toast({
        title: "Template needs a name",
        description: "Give your template a helpful title before saving.",
      });
      return;
    }

    if (!sections.length) {
      toast({
        title: "Add a section first",
        description: "Insert at least one section before saving to the cloud.",
      });
      return;
    }

    setSaving(true);
    const payloadSections = sections.map((section, index) => ({
      type: section.type,
      title: section.title,
      orderIndex: index,
      filename: section.filename ?? null,
      content: section.content ?? "",
    }));

    try {
      if (!templateId) {
        const response = await fetch("/api/templates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: normalizedName,
            category,
            sections: payloadSections,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          toast({
            title: "Unable to save template",
            description: data?.error ?? "Please try again later.",
            variant: "destructive",
          });
          return;
        }

        const data = await response.json();
        if (typeof data?.walletBalance === "number") {
          broadcastWalletBalance(data.walletBalance);
        }
        hydrateFromTemplate({
          id: data.id,
          name: data.name,
          category: (data.category ?? category) as TemplateCategory,
          sections: toBuilderSections(data.sections as ApiSection[]),
        });
      } else {
        const metadataResponse = await fetch(`/api/templates/${templateId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: normalizedName,
            category,
          }),
        });

        if (!metadataResponse.ok) {
          const data = await metadataResponse.json().catch(() => null);
          toast({
            title: "Could not update template",
            description: data?.error ?? "Please try again.",
            variant: "destructive",
          });
          return;
        }

        const sectionsResponse = await fetch(
          `/api/templates/${templateId}/sections`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sections: payloadSections,
            }),
          },
        );

        if (!sectionsResponse.ok) {
          const data = await sectionsResponse.json().catch(() => null);
          toast({
            title: "Could not update sections",
            description: data?.error ?? "Try again in a moment.",
            variant: "destructive",
          });
          return;
        }

        const updated = await sectionsResponse.json();
        if (typeof updated?.walletBalance === "number") {
          broadcastWalletBalance(updated.walletBalance);
        }
        hydrateFromTemplate({
          id: updated.id,
          name: updated.name,
          category: (updated.category ?? category) as TemplateCategory,
          sections: toBuilderSections(updated.sections as ApiSection[]),
        });
      }

      markClean();
      toast({
        title: "Template saved",
        description: "Your template is synced to the cloud.",
      });
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({
        title: "Save failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [
    category,
    hydrateFromTemplate,
    isAuthenticated,
    markClean,
    name,
    router,
    sections,
    templateId,
    toast,
  ]);

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-1 flex-col gap-2 sm:max-w-xl sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-col gap-1">
            <label
              htmlFor="template-name"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Template name
            </label>
            <Input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My AI context template"
              className="h-10"
            />
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-row sm:justify-end">
          <div className="w-full sm:w-auto">
            <div className="flex flex-col gap-1 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-wide">
                Total summary
              </span>
              <div className="text-sm text-foreground">
                Words: {totalMetrics.words.toLocaleString()} | Characters:{" "}
                {totalMetrics.characters.toLocaleString()} | Tokens: ~
                {totalMetrics.tokens.toLocaleString()}
              </div>
            </div>
          </div>
          {isAuthenticated ? (
            <div className="flex flex-col items-start gap-1">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={handleSave}
                disabled={
                  saving ||
                  !dirty ||
                  sections.length === 0 ||
                  status === "loading"
                }
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                {templateId ? "Save changes" : "Save template"}
              </Button>
              {builderCosts.save > 0 ? (
                <span className="text-xs text-muted-foreground">
                  Uses {formatCoinCost(builderCosts.save)}.
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-1">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() =>
                  signIn(undefined, { callbackUrl: "/builder" }).catch(() => null)
                }
                disabled={status === "loading"}
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Sign in
              </Button>
              {builderCosts.save > 0 ? (
                <span className="text-xs text-muted-foreground">
                  Uses {formatCoinCost(builderCosts.save)} once you are signed in.
                </span>
              ) : null}
            </div>
          )}
          <div className="flex flex-col items-start gap-1">
            <Button
              type="button"
              className="gap-2"
              onClick={handleCopy}
              disabled={copying}
            >
              {copying ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <span className="text-sm font-medium">Copy</span>
              )}
            </Button>
            {builderCosts.copy > 0 ? (
              <span className="text-xs text-muted-foreground">
                Uses {formatCoinCost(builderCosts.copy)}.
              </span>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              .txt
            </Button>
            {builderCosts.download > 0 ? (
              <span className="text-xs text-muted-foreground">
                Uses {formatCoinCost(builderCosts.download)}.
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
