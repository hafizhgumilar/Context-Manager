"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star, Trash2, Copy, Loader2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/hooks/use-toast";
import { useBuilderStore } from "@/lib/store/builder-store";
import { AppTopbar } from "@/components/navigation/app-topbar";

type TemplateSummary = {
  id: string;
  name: string;
  category: string;
  isStarred: boolean;
  updatedAt: string;
  createdAt: string;
};

type TemplatesDashboardProps = {
  initialTemplates: TemplateSummary[];
  slotsUsed: number;
  slotLimit: number;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  hour12: true,
});

function formatTimestamp(timestamp: string) {
  try {
    return DATE_FORMATTER.format(new Date(timestamp));
  } catch {
    return timestamp;
  }
}

export function TemplatesDashboard({
  initialTemplates,
  slotsUsed,
  slotLimit,
}: TemplatesDashboardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const resetBuilder = useBuilderStore((state) => state.reset);
  const [templates, setTemplates] = useState<TemplateSummary[]>(initialTemplates);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [slotsUsedState, setSlotsUsedState] = useState(slotsUsed);
  const [slotLimitState, setSlotLimitState] = useState(slotLimit);
  const [isMutating, startMutate] = useTransition();
  const initialLoadRef = useRef(true);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedTerm(searchTerm.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  const loadTemplates = useCallback(
    async (opts: { query: string; favorited: boolean }) => {
      setIsFetching(true);
      const params = new URLSearchParams();
      if (opts.query) params.set("q", opts.query);
      if (opts.favorited) params.set("favorited", "1");
      try {
      const response = await fetch(
        `/api/templates${params.toString() ? `?${params.toString()}` : ""}`,
        {
          method: "GET",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load templates");
      }

        const data = await response.json();
        setTemplates(
          (data.templates ?? []).map((template: TemplateSummary) => ({
            ...template,
            updatedAt: template.updatedAt,
            createdAt: template.createdAt,
          })),
        );
        setSlotsUsedState(data.slotsUsed ?? 0);
        setSlotLimitState((value) => data.slotLimit ?? value);
      } catch (error) {
        console.error(error);
        toast({
          title: "Unable to load templates",
          description: "Please try again in a few seconds.",
          variant: "destructive",
        });
      } finally {
        setIsFetching(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    loadTemplates({ query: debouncedTerm, favorited: favoritesOnly }).catch(() =>
      null,
    );
  }, [debouncedTerm, favoritesOnly, loadTemplates]);

  const handleCreateNew = useCallback(() => {
    resetBuilder();
    router.push("/builder");
  }, [resetBuilder, router]);

  const handleToggleFavorite = (template: TemplateSummary) => {
    startMutate(async () => {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isStarred: !template.isStarred }),
      });

      if (!response.ok) {
        toast({
          title: "Unable to update favorite",
          description: "Please try again later.",
          variant: "destructive",
        });
        return;
      }

      setTemplates((current) =>
        current
          .map((item) =>
            item.id === template.id
              ? { ...item, isStarred: !template.isStarred }
              : item,
          )
          .sort((a, b) =>
            Number(b.isStarred) - Number(a.isStarred) ||
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          ),
      );
    });
  };

  const handleDuplicate = (templateId: string) => {
    startMutate(async () => {
      const response = await fetch(`/api/templates/${templateId}/duplicate`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast({
          title: "Could not duplicate template",
          description: data?.error ?? "Slot limit might be reached.",
          variant: "destructive",
        });
        return;
      }

      const data = await response.json();
      setTemplates((current) => [
        {
          id: data.id,
          name: data.name,
          category: data.category,
          isStarred: data.isStarred,
          updatedAt: data.updatedAt,
          createdAt: data.createdAt,
        },
        ...current,
      ]);
      setSlotsUsedState((value) => value + 1);
      toast({
        title: "Template duplicated",
        description: "Copy created successfully.",
      });
    });
  };

  const handleDelete = (templateId: string) => {
    startMutate(async () => {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        toast({
          title: "Unable to delete template",
          description: "Please try again.",
          variant: "destructive",
        });
        return;
      }

      setTemplates((current) =>
        current.filter((template) => template.id !== templateId),
      );
      setSlotsUsedState((value) => Math.max(0, value - 1));
      toast({
        title: "Template deleted",
        description: "The template was removed from your library.",
      });
    });
  };

  const filteredTemplates = useMemo(() => templates, [templates]);

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <AppTopbar />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 lg:px-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-border/80 bg-background/90 p-6 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">My Templates</h1>
            <p className="text-sm text-muted-foreground">
              Access saved contexts, star favorites, duplicate, or open them in the builder.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              <span>
                Slots used:{" "}
                <span className="font-medium text-foreground">
                  {slotsUsedState}
                </span>{" "}
                / {slotLimitState}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={handleCreateNew}
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              New template
            </Button>
            <Button onClick={() => router.push("/builder")}>Open builder</Button>
          </div>
        </header>

        <Card className="border border-border/80 bg-background/90 shadow-sm backdrop-blur">
          <CardHeader className="space-y-4">
            <CardTitle className="text-lg">Manage</CardTitle>
            <CardDescription>
              Search your library, filter favorites, and keep everything organized.
            </CardDescription>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <Input
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="favorites-only"
                  checked={favoritesOnly}
                  onCheckedChange={(value) => setFavoritesOnly(Boolean(value))}
                />
                <Label htmlFor="favorites-only" className="text-sm">
                  Favorites only
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Separator />
            {isFetching && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating templates...
              </div>
            )}
            {filteredTemplates.length === 0 && !isFetching ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/10 px-6 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  {favoritesOnly
                    ? "No favorites yet. Star templates to pin them here."
                    : "No templates saved yet. Build one and save it from the builder."}
                </p>
                <Button
                  className="mt-4"
                  onClick={() => router.push("/builder")}
                >
                  Start building
                </Button>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex flex-col rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm transition hover:border-primary/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold">{template.name}</h2>
                      <Badge variant="secondary" className="uppercase">
                        {template.category.replace("_", " ")}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(template)}
                      className="rounded-full p-1 text-muted-foreground transition hover:text-yellow-500"
                      aria-label={
                        template.isStarred
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }
                      disabled={isMutating}
                    >
                      <Star
                        className={`h-5 w-5 ${
                          template.isStarred ? "fill-current text-yellow-500" : ""
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p>
                      Updated:{" "}
                      <span className="text-foreground">
                        {formatTimestamp(template.updatedAt)}
                      </span>
                    </p>
                    <p>
                      Created:{" "}
                      <span className="text-foreground">
                        {formatTimestamp(template.createdAt)}
                      </span>
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        router.push(`/builder?templateId=${template.id}`)
                      }
                    >
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDuplicate(template.id)}
                      disabled={isMutating}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(template.id)}
                      disabled={isMutating}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                    <Link
                      href={`/builder?templateId=${template.id}`}
                      className="ml-auto text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Edit in builder
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
