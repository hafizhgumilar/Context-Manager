"use client";

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DraggableAttributes,
  type DragEndEvent,
  type DragStartEvent,
  type SyntheticListenerMap,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ClipboardList,
  CloudUpload,
  Grip,
  Trash,
  Wand2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useBuilderStore, type BuilderSection } from "@/lib/store/builder-store";
import { shallow } from "zustand/shallow";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { measureText } from "@/lib/text-metrics";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-xs text-muted-foreground">
        Loading editor...
      </div>
    ),
  },
);

function getLanguageFromFilename(filename?: string) {
  if (!filename) return "plaintext";
  const extension = filename.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "ts":
      return "typescript";
    case "tsx":
      return "typescriptreact";
    case "js":
      return "javascript";
    case "jsx":
      return "javascriptreact";
    case "json":
      return "json";
    case "py":
      return "python";
    case "md":
      return "markdown";
    case "sql":
      return "sql";
    case "yml":
    case "yaml":
      return "yaml";
    case "css":
      return "css";
    case "html":
      return "html";
    case "rs":
      return "rust";
    case "go":
      return "go";
    case "java":
      return "java";
    case "rb":
      return "ruby";
    case "c":
      return "c";
    case "cpp":
    case "cxx":
      return "cpp";
    case "sh":
      return "shell";
    default:
      return "plaintext";
  }
}

type SectionCardProps = {
  sectionId: string;
  onRemove: (id: string) => void;
  onContentChange: (id: string, content: string) => void;
  onFilenameChange: (id: string, filename: string) => void;
};

type SectionCardViewProps = {
  section: BuilderSection;
  isDragging?: boolean;
  isOverlay?: boolean;
  listeners?: SyntheticListenerMap;
  attributes?: DraggableAttributes;
  style?: CSSProperties;
  onRemove: (id: string) => void;
  onContentChange: (id: string, content: string) => void;
  onFilenameChange: (id: string, filename: string) => void;
};

const AutoResizeTextarea = memo(function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-h-[120px] resize-none border-border/70 bg-background/80 text-sm leading-6 overflow-hidden"
    />
  );
});

const AttachmentEditor = memo(function AttachmentEditor({
  id,
  filename,
  content,
  onContentChange,
  suspended = false,
}: {
  id: string;
  filename?: string;
  content: string;
  onContentChange: (id: string, content: string) => void;
  suspended?: boolean;
}) {
  if (suspended) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/40 text-xs text-muted-foreground">
        Attachment preview hidden while dragging
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background/90">
      <MonacoEditor
        height="320px"
        language={getLanguageFromFilename(filename)}
        theme="vs-dark"
        value={content}
        onChange={(value) => onContentChange(id, value ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
});

const SectionCardView = memo(
  forwardRef<HTMLDivElement, SectionCardViewProps>(function SectionCardView(
    {
      section,
      isDragging = false,
      isOverlay = false,
      listeners,
      attributes,
      style,
      onRemove,
      onContentChange,
      onFilenameChange,
    },
    ref,
  ) {
    const isAttachment = section.type === "attachment";
    const metrics = useMemo(
      () => measureText(section.content),
      [section.content],
    );
    const suspendAttachmentContent = isAttachment && (isDragging || isOverlay);
    const cardStyle = useMemo<CSSProperties>(() => {
      const next: CSSProperties = {
        scrollMarginTop: "96px",
      };
      if (style) {
        Object.assign(next, style);
      }
      return next;
    }, [style]);

    return (
      <Card
        ref={ref}
        id={`builder-section-${section.id}`}
        data-builder-section-id={section.id}
        data-builder-section-type={section.type}
        style={cardStyle}
        data-dnd-dragging={isDragging ? "true" : undefined}
        className={cn(
          "builder-section-card border-border/60 bg-card/70 shadow-sm transition will-change-transform",
          isDragging && "border-primary/60 shadow-none ring-1 ring-primary/50",
          isOverlay && "pointer-events-none select-none opacity-95",
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-3 text-base">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/12 via-primary/5 to-primary/0 text-primary ring-1 ring-primary/15 shadow-inner">
                {isAttachment ? (
                  <CloudUpload className="h-4 w-4" />
                ) : (
                  <ClipboardList className="h-4 w-4" />
                )}
              </span>
              {section.title}
            </CardTitle>
            <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
              {section.type.replace("_", " ")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={cn(
                "cursor-grab rounded-lg border border-border/60 bg-gradient-to-br from-background/85 to-background/60 p-1.5 text-muted-foreground transition hover:border-primary/40 hover:text-primary active:cursor-grabbing",
                isOverlay && "cursor-default opacity-50",
              )}
              {...attributes}
              {...listeners}
              aria-label="Drag to reorder"
              tabIndex={isOverlay ? -1 : 0}
              disabled={isOverlay}
            >
              <Grip className="h-4 w-4" />
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
              onClick={() => onRemove(section.id)}
              aria-label="Delete section"
              disabled={isOverlay}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAttachment ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`filename-${section.id}`} className="text-xs">
                  Filename
                </Label>
                <Input
                  id={`filename-${section.id}`}
                  value={section.filename ?? ""}
                  onChange={(event) =>
                    onFilenameChange(section.id, event.target.value)
                  }
                  placeholder="attachment.txt"
                  className="h-9"
                  disabled={isOverlay}
                />
              </div>
              <AttachmentEditor
                id={section.id}
                filename={section.filename}
                content={section.content}
                onContentChange={onContentChange}
                suspended={suspendAttachmentContent}
              />
            </>
          ) : (
            <AutoResizeTextarea
              value={section.content}
              onChange={(value) => onContentChange(section.id, value)}
              placeholder="Add detailed instructions, context, or notes..."
            />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Characters: {metrics.characters}</span>
              <span>Words: {metrics.words}</span>
              <span>Tokens: ~{metrics.tokens}</span>
            </div>
            {!isAttachment && (
              <Badge variant="outline" className="uppercase">
                Editable
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }),
);

const SortableSectionCard = memo(function SortableSectionCard({
  sectionId,
  onRemove,
  onContentChange,
  onFilenameChange,
}: SectionCardProps) {
  const section = useBuilderStore(
    (state) => state.sectionsById[sectionId],
    shallow,
  );
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sectionId });

  const style = useMemo<CSSProperties>(() => {
    if (!transform) return { transition };
    return {
      transform: CSS.Transform.toString(transform),
      transition,
    };
  }, [transform, transition]);

  if (!section) {
    return null;
  }

  return (
    <SectionCardView
      ref={setNodeRef}
      section={section}
      attributes={attributes}
      listeners={listeners}
      isDragging={isDragging}
      style={style}
      onRemove={onRemove}
      onContentChange={onContentChange}
      onFilenameChange={onFilenameChange}
    />
  );
});

export function SectionCanvas() {
  const sectionOrder = useBuilderStore((state) => state.sectionOrder, shallow);
  const removeSection = useBuilderStore((state) => state.removeSection);
  const updateSectionContent = useBuilderStore((state) => state.updateSectionContent);
  const updateSectionFilename = useBuilderStore(
    (state) => state.updateSectionFilename,
  );
  const reorderSections = useBuilderStore((state) => state.reorderSections);
  const addSection = useBuilderStore((state) => state.addSection);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        setActiveId(null);
        return;
      }
      reorderSections(String(active.id), String(over.id));
      setActiveId(null);
    },
    [reorderSections],
  );

  const activeSection = useBuilderStore(
    useCallback(
      (state) => (activeId ? state.sectionsById[activeId] ?? null : null),
      [activeId],
    ),
  );

  const emptyState = sectionOrder.length === 0;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sectionOrder}
          strategy={verticalListSortingStrategy}
        >
          <div className="builder-section-stack relative">
            {sectionOrder.map((sectionId) => (
              <SortableSectionCard
                key={sectionId}
                sectionId={sectionId}
                onRemove={removeSection}
                onContentChange={updateSectionContent}
                onFilenameChange={updateSectionFilename}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 150, easing: "ease-out" }}>
          {activeSection ? (
            <SectionCardView
              section={activeSection}
              isOverlay
              onRemove={removeSection}
              onContentChange={updateSectionContent}
              onFilenameChange={updateSectionFilename}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {emptyState && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wand2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Start your context</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick sections from the library to build a structured AI prompt.
          </p>
          <Button
            className="mt-6"
            onClick={() => addSection("system_prompt")}
          >
            Add system prompt
          </Button>
        </div>
      )}
    </div>
  );
}
