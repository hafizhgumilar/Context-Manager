from pathlib import Path
path = Path('components/builder/quick-jump-panel.tsx')
lines = path.read_text().splitlines()
start = None
end = None
for idx,line in enumerate(lines):
    if 'pointer-events-none' in line and 'QuickJumpOverlayItem' in line:
        start = idx
        break
if start is None:
    raise SystemExit('overlay not found')
for idx in range(start, len(lines)):
    if lines[idx].strip() == '</div>':
        end = idx
        break
block = '''    <div className="min-w-[18rem] max-w-[18rem]">
      <div
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border border-border/70 bg-background/95 px-3 py-2 text-sm shadow-lg backdrop-blur",
          showCurrent && "border-primary/60 bg-primary/10 text-primary",
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-border/70 bg-background/80 text-muted-foreground/70">
          <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <div className="flex flex-1 flex-col">
          <span className="font-medium leading-5">{section.title}</span>
          <span className="text-[11px] uppercase text-muted-foreground">
            {section.type.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showCurrent && (
            <Badge
              variant="outline"
              className="text-[10px] uppercase text-primary"
            >
              Current
            </Badge>
          )}
          <ChevronRight
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>'''
lines = lines[:start-2] + block.splitlines() + lines[end+1:]
path.write_text('\n'.join(lines)+"\n")
