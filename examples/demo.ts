import assert from "node:assert/strict";

type WorkItem = {
  id: string;
  title: string;
  priority: number;
  blocked?: boolean;
};

type Plan = {
  selected: WorkItem[];
  skipped: WorkItem[];
};

function planNext(items: WorkItem[], limit = 3): Plan {
  const available = items.filter((item) => !item.blocked);
  const selected = [...available]
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, limit);
  const selectedIds = new Set(selected.map((item) => item.id));
  return {
    selected,
    skipped: items.filter((item) => !selectedIds.has(item.id)),
  };
}

function demo(): void {
  const plan = planNext([
    { id: "scan", title: "Ingest supplier CSV", priority: 2 },
    { id: "price", title: "Refresh market pricing", priority: 5 },
    { id: "report", title: "Draft operations report", priority: 3 },
    { id: "ship", title: "Publish listing batch", priority: 4, blocked: true },
  ], 2);

  assert.deepEqual(plan.selected.map((item) => item.id), ["price", "report"]);
  assert.equal(plan.skipped.length, 2);
  console.log("demo ok: selected", plan.selected.map((item) => item.id).join(", "));
}

demo();
