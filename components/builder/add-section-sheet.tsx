"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABELS,
  type TemplateCategory,
  SECTION_DEFINITIONS,
} from "@/lib/section-taxonomy";
import { useBuilderStore } from "@/lib/store/builder-store";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type AddSectionSheetProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

export function AddSectionSheet({ open, onOpenChange }: AddSectionSheetProps) {
  const addSection = useBuilderStore((state) => state.addSection);
  const [category, setCategory] = useState<TemplateCategory>("basic");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const definitions = useMemo(() => {
    const entry = TEMPLATE_CATEGORIES.find((item) => item.id === category);
    if (!entry) {
      return [];
    }
    return entry.sectionTypes
      .map((type) => SECTION_DEFINITIONS[type])
      .filter((definition) => {
        if (!query) return true;
        const normalizedQuery = query.toLowerCase();
        return (
          definition.title.toLowerCase().includes(normalizedQuery) ||
          definition.type.toLowerCase().includes(normalizedQuery)
        );
      });
  }, [category, query]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] overflow-hidden rounded-t-3xl border-t border-border/60 bg-background/95 backdrop-blur"
      >
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle>Add a new section</SheetTitle>
          <SheetDescription>
            Combine multiple section types to shape the context you send to the
            AI assistant.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-4">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sections..."
            className="h-9"
          />
          <Tabs
            value={category}
            onValueChange={(value) => setCategory(value as TemplateCategory)}
          >
            <TabsList className="flex flex-wrap gap-2 bg-muted/60">
              {TEMPLATE_CATEGORIES.map((item) => (
                <TabsTrigger key={item.id} value={item.id} className="text-xs">
                  {TEMPLATE_CATEGORY_LABELS[item.id]}
                </TabsTrigger>
              ))}
            </TabsList>
            {TEMPLATE_CATEGORIES.map((item) => (
              <TabsContent key={item.id} value={item.id}>
                <ScrollArea className="h-[48vh] pr-4">
                  <div className="grid gap-3 pb-12">
                    {definitions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No sections match your search.
                      </p>
                    ) : (
                      definitions.map((definition) => (
                        <div
                          key={definition.type}
                          className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-4"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold">
                                {definition.title}
                              </span>
                              <Badge variant="outline">
                                {definition.type.replace("_", " ")}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {definition.description}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              addSection(definition.type);
                              onOpenChange(false);
                            }}
                            className="gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Add section
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

