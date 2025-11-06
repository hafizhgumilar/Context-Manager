"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABELS,
  type SectionType,
  type TemplateCategory,
  SECTION_DEFINITIONS,
} from "@/lib/section-taxonomy";
import { useBuilderStore } from "@/lib/store/builder-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SectionLibraryProps = {
  activeCategory: TemplateCategory;
  onCategoryChange: (category: TemplateCategory) => void;
  onAddSection?: () => void;
};

type SectionListItem = {
  type: SectionType;
  title: string;
  description: string;
  isFavorite: boolean;
};

function buildSectionList(
  category: TemplateCategory,
  query: string,
  favoritesOnly: boolean,
  favoriteTypes: SectionType[],
): SectionListItem[] {
  const categoryEntry = TEMPLATE_CATEGORIES.find(
    (entry) => entry.id === category,
  );

  if (!categoryEntry) {
    return [];
  }

  return categoryEntry.sectionTypes
    .map((type) => SECTION_DEFINITIONS[type])
    .filter((definition) => {
      const matchesQuery =
        !query ||
        definition.title.toLowerCase().includes(query.toLowerCase()) ||
        definition.type.includes(query.toLowerCase());

      const matchesFavorite = !favoritesOnly
        ? true
        : favoriteTypes.includes(definition.type);

      return matchesQuery && matchesFavorite;
    })
    .map((definition) => ({
      type: definition.type,
      title: definition.title,
      description: definition.description,
      isFavorite: favoriteTypes.includes(definition.type),
    }));
}

export function SectionLibrary({
  activeCategory,
  onCategoryChange,
  onAddSection,
}: SectionLibraryProps) {
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const favoriteSectionTypes = useBuilderStore(
    (state) => state.favoriteSectionTypes,
  );
  const toggleFavoriteType = useBuilderStore(
    (state) => state.toggleFavoriteType,
  );
  const addSection = useBuilderStore((state) => state.addSection);

  const sections = useMemo(
    () =>
      buildSectionList(
        activeCategory,
        query,
        favoritesOnly,
        favoriteSectionTypes,
      ),
    [activeCategory, query, favoritesOnly, favoriteSectionTypes],
  );

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Sections
          </h2>
          <Tabs
            value={activeCategory}
            onValueChange={(value) => {
              onCategoryChange(value as TemplateCategory);
            }}
            className="w-full"
          >
            <TabsList className="flex flex-col gap-2 bg-muted/50 p-2 !h-auto">
              {TEMPLATE_CATEGORIES.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="w-full justify-start text-xs"
                >
                  {TEMPLATE_CATEGORY_LABELS[category.id]}
                </TabsTrigger>
              ))}
            </TabsList>
            {TEMPLATE_CATEGORIES.map((category) => (
              <TabsContent key={category.id} value={category.id}>
                <div className="flex flex-col gap-4">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search sections..."
                    className="h-9"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="favorites-only"
                        checked={favoritesOnly}
                        onCheckedChange={(checked) =>
                          setFavoritesOnly(Boolean(checked))
                        }
                      />
                      <Label
                        htmlFor="favorites-only"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Favorites only
                      </Label>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFavoritesOnly(false);
                        setQuery("");
                        onCategoryChange(category.id);
                      }}
                    >
                      Reset
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    {sections.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No sections match your filters. Try a different search.
                      </p>
                    )}
                    {sections.map((section) => (
                      <Card
                        key={section.type}
                        className="border border-border/80 bg-background/80 shadow-sm transition hover:border-primary/60"
                      >
                        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                          <div className="flex flex-col">
                            <CardTitle className="text-sm">
                              {section.title}
                            </CardTitle>
                            <Badge
                              variant="secondary"
                              className="mt-1 w-max uppercase"
                            >
                              {section.type.replace("_", " ")}
                            </Badge>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleFavoriteType(section.type)}
                            className={cn(
                              "rounded-full p-1 text-muted-foreground transition hover:text-yellow-500",
                              section.isFavorite && "text-yellow-500",
                            )}
                            aria-label={
                              section.isFavorite
                                ? "Remove from library favorites"
                                : "Add to library favorites"
                            }
                          >
                            <Star
                              className={cn(
                                "h-4 w-4",
                                section.isFavorite && "fill-current",
                              )}
                              aria-hidden="true"
                            />
                          </button>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-0">
                          <CardDescription className="text-xs text-muted-foreground">
                            {section.description}
                          </CardDescription>
                          <Button
                            type="button"
                            size="sm"
                            className="w-full"
                            onClick={() => addSection(section.type)}
                          >
                            Add section
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={onAddSection}
          className="w-full"
        >
          Add via quick picker
        </Button>
      </div>
    </div>
  );
}




