from pathlib import Path
path = Path('hooks/use-section-observer.ts')
lines = path.read_text().splitlines()
start = None
end = None
for idx,line in enumerate(lines):
    if 'let bestId' in line:
        start = idx
    if start is not None and 'nextActiveId = bestId' in line:
        end = idx
        break
# We'll replace block with new logic
new_block = '''          let bestId: string | null = null;
          let bestRatio = -1;
          let bestTop = Number.POSITIVE_INFINITY;

          visibleByOrder.forEach((id) => {
            const entry = visibilityRef.current.get(id);
            if (!entry) {
              return;
            }
            const ratio = entry.intersectionRatio;
            const top = entry.boundingClientRect.top;
            if (
              ratio > bestRatio ||
              (ratio === bestRatio && top < bestTop)
            ) {
              bestId = id;
              bestRatio = ratio;
              bestTop = top;
            }
          });

          nextActiveId = bestId ?? visibleByOrder[0] ?? null;'''
if start is None or end is None:
    raise SystemExit('target not found')
lines = lines[:start-1] + new_block.splitlines() + lines[end+1:]
path.write_text("\n".join(lines)+"\n")
