"use client";

import { arrayMove } from "@dnd-kit/sortable";
import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import {
  FAVORITE_SECTION_TYPES,
  TEMPLATE_CATEGORIES,
  type SectionType,
  type TemplateCategory,
  createSectionDraft,
  SECTION_DEFINITIONS,
} from "@/lib/section-taxonomy";

export type BuilderSection = {
  id: string;
  type: SectionType;
  title: string;
  content: string;
  filename?: string;
  orderIndex: number;
};

export type BuilderState = {
  templateId: string | null;
  name: string;
  category: TemplateCategory;
  sectionsById: Record<string, BuilderSection>;
  sectionOrder: string[];
  dirty: boolean;
  favoriteSectionTypes: SectionType[];
  setName: (name: string) => void;
  setCategory: (category: TemplateCategory) => void;
  addSection: (type: SectionType) => void;
  removeSection: (id: string) => void;
  updateSectionContent: (id: string, content: string) => void;
  updateSectionFilename: (id: string, filename: string) => void;
  reorderSections: (activeId: string, overId: string) => void;
  toggleFavoriteType: (type: SectionType) => void;
  reset: (category?: TemplateCategory) => void;
  hydrateFromTemplate: (payload: {
    id: string;
    name: string;
    category: TemplateCategory;
    sections: BuilderSection[];
  }) => void;
  markClean: () => void;
};

const STORAGE_KEY = "context-manager:builder";

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 11);
}

function normalizeSections(sections: BuilderSection[]) {
  const nextOrder: string[] = [];
  const nextMap: Record<string, BuilderSection> = {};

  sections
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .forEach((section, index) => {
      const normalized: BuilderSection = {
        ...section,
        orderIndex: index,
      };
      nextOrder.push(normalized.id);
      nextMap[normalized.id] = normalized;
    });

  return { order: nextOrder, map: nextMap };
}

function applyOrderIndexes(
  order: string[],
  sectionsById: Record<string, BuilderSection>,
) {
  let next = sectionsById;
  let mutated = false;

  order.forEach((id, index) => {
    const section = next[id];
    if (!section) {
      return;
    }
    if (section.orderIndex !== index) {
      if (!mutated) {
        next = { ...sectionsById };
        mutated = true;
      }
      next[id] = { ...section, orderIndex: index };
    }
  });

  return next;
}

export const useBuilderStore = create<BuilderState>()(
  devtools(
    persist(
      (set) => ({
        templateId: null,
        name: "",
        category: "basic",
        sectionsById: {},
        sectionOrder: [],
        dirty: false,
        favoriteSectionTypes: FAVORITE_SECTION_TYPES,
        setName: (name) => set({ name, dirty: true }),
        setCategory: (category) =>
          set((state) => {
            if (state.category === category) {
              return state;
            }
            return {
              category,
              dirty: true,
            };
          }),
        addSection: (type) =>
          set((state) => {
            const draft = createSectionDraft(type);
            const newSection: BuilderSection = {
              ...draft,
              id: generateId(),
              title: draft.title,
              orderIndex: state.sectionOrder.length,
            };
            return {
              sectionsById: {
                ...state.sectionsById,
                [newSection.id]: newSection,
              },
              sectionOrder: [...state.sectionOrder, newSection.id],
              dirty: true,
            };
          }),
        removeSection: (id) =>
          set((state) => {
            const nextOrder = state.sectionOrder.filter(
              (sectionId) => sectionId !== id,
            );
            if (nextOrder.length === state.sectionOrder.length) {
              return state;
            }
            const nextMap = Object.keys(state.sectionsById).reduce<
              Record<string, BuilderSection>
            >((acc, key) => {
              if (key !== id) {
                acc[key] = state.sectionsById[key];
              }
              return acc;
            }, {});

            return {
              sectionsById: applyOrderIndexes(nextOrder, nextMap),
              sectionOrder: nextOrder,
              dirty: true,
            };
          }),
        updateSectionContent: (id, content) =>
          set((state) => ({
            sectionsById: state.sectionsById[id]
              ? {
                  ...state.sectionsById,
                  [id]: { ...state.sectionsById[id], content },
                }
              : state.sectionsById,
            dirty: true,
          })),
        updateSectionFilename: (id, filename) =>
          set((state) => ({
            sectionsById: state.sectionsById[id]
              ? {
                  ...state.sectionsById,
                  [id]: {
                    ...state.sectionsById[id],
                    filename,
                    title: SECTION_DEFINITIONS.attachment.title,
                  },
                }
              : state.sectionsById,
            dirty: true,
          })),
        reorderSections: (activeId, overId) =>
          set((state) => {
            if (activeId === overId) {
              return state;
            }

            const currentIndex = state.sectionOrder.indexOf(activeId);
            const overIndex = state.sectionOrder.indexOf(overId);

            if (currentIndex === -1 || overIndex === -1) {
              return state;
            }

            let performanceLabel: string | null = null;

            if (typeof performance !== "undefined" && "mark" in performance) {
              performanceLabel = `builder:reorderSections:${activeId}->${overId}`;
              performance.mark(`${performanceLabel}:start`);
            }

            const nextOrder = arrayMove(
              state.sectionOrder,
              currentIndex,
              overIndex,
            );

            const nextState = {
              sectionOrder: nextOrder,
              sectionsById: applyOrderIndexes(nextOrder, state.sectionsById),
              dirty: true,
            };

            if (
              performanceLabel &&
              typeof performance !== "undefined" &&
              "mark" in performance
            ) {
              performance.mark(`${performanceLabel}:end`);
              if ("measure" in performance) {
                try {
                  performance.measure(
                    performanceLabel,
                    `${performanceLabel}:start`,
                    `${performanceLabel}:end`,
                  );
                } catch {
                  // ignored: measurements can throw if marks are missing
                }
              }
              if ("clearMarks" in performance) {
                performance.clearMarks(`${performanceLabel}:start`);
                performance.clearMarks(`${performanceLabel}:end`);
              }
              if ("clearMeasures" in performance) {
                performance.clearMeasures(performanceLabel);
              }
            }

            return nextState;
          }),
        toggleFavoriteType: (type) =>
          set((state) => {
            const next = state.favoriteSectionTypes.includes(type)
              ? state.favoriteSectionTypes.filter((item) => item !== type)
              : [...state.favoriteSectionTypes, type];
            return { favoriteSectionTypes: next };
          }),
        reset: (category = "basic") =>
          set(() => ({
            templateId: null,
            name: "",
            category,
            sectionsById: {},
            sectionOrder: [],
            dirty: false,
          })),
        hydrateFromTemplate: ({ id, name, category, sections }) =>
          set(() => {
            const normalized = normalizeSections(sections);
            return {
              templateId: id,
              name,
              category,
              sectionsById: normalized.map,
              sectionOrder: normalized.order,
              dirty: false,
            };
          }),
        markClean: () => set({ dirty: false }),
      }),
      {
        name: STORAGE_KEY,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          templateId: state.templateId,
          name: state.name,
          category: state.category,
          sectionOrder: state.sectionOrder,
          sectionsById: state.sectionsById,
          favoriteSectionTypes: state.favoriteSectionTypes,
        }),
        onRehydrateStorage: () => (state) => {
          if (!state) return;
          const categoryExists = TEMPLATE_CATEGORIES.some(
            (entry) => entry.id === state.category,
          );
          if (!categoryExists) {
            state.category = "basic";
          }
          type PersistedState = Partial<BuilderState> & {
            sections?: BuilderSection[];
          };

          const persistedState = state as PersistedState;

          const legacySections = Array.isArray(persistedState.sections)
            ? persistedState.sections
            : undefined;

          const normalized = normalizeSections(
            legacySections ??
              Object.values(persistedState.sectionsById ?? {}).map(
                (section) => ({
                  ...section,
                  orderIndex: section.orderIndex ?? 0,
                }),
              ),
          );

          persistedState.sectionOrder = normalized.order;
          persistedState.sectionsById = normalized.map;
          if ("sections" in persistedState) {
            delete persistedState.sections;
          }
        },
      },
    ),
  ),
);
