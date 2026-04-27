import { useEffect, useState } from "react";
import { Check, Plus, Trash2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
};

type Filter = "all" | "active" | "done";

const STORAGE_KEY = "flow.todos.v1";

export function Flow() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTodos(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos, hydrated]);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setTodos((t) => [
      { id: crypto.randomUUID(), text, done: false, createdAt: Date.now() },
      ...t,
    ]);
    setInput("");
  };

  const toggle = (id: string) =>
    setTodos((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));

  const remove = (id: string) =>
    setTodos((t) => t.filter((x) => x.id !== id));

  const clearDone = () => setTodos((t) => t.filter((x) => !x.done));

  const visible = todos.filter((t) =>
    filter === "all" ? true : filter === "active" ? !t.done : t.done,
  );
  const remaining = todos.filter((t) => !t.done).length;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <div className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <header className="mb-10 text-center">
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground"
            style={{
              background: "var(--gradient-primary)",
              boxShadow: "var(--shadow-glow)",
            }}
          >
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Flow
          </h1>
          <p className="mt-2 text-muted-foreground">
            A calm, focused space for what matters today.
          </p>
        </header>

        <form
          onSubmit={add}
          className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2"
          style={{ boxShadow: "var(--shadow-soft)" }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What's on your mind?"
            className="flex-1 bg-transparent px-3 py-2 text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "var(--gradient-primary)" }}
            aria-label="Add task"
          >
            <Plus className="h-5 w-5" />
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {(["all", "active", "done"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <span className="text-muted-foreground">
            {remaining} {remaining === 1 ? "task" : "tasks"} left
          </span>
        </div>

        <ul className="mt-4 space-y-2">
          {visible.map((t) => (
            <li
              key={t.id}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-all hover:border-primary/40"
              style={{ boxShadow: "var(--shadow-soft)" }}
            >
              <button
                onClick={() => toggle(t.id)}
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                  t.done
                    ? "border-transparent text-primary-foreground"
                    : "border-border hover:border-primary",
                )}
                style={t.done ? { background: "var(--gradient-primary)" } : undefined}
                aria-label={t.done ? "Mark as not done" : "Mark as done"}
              >
                {t.done && <Check className="h-3.5 w-3.5" />}
              </button>
              <span
                className={cn(
                  "flex-1 text-foreground transition-all",
                  t.done && "text-muted-foreground line-through",
                )}
              >
                {t.text}
              </span>
              <button
                onClick={() => remove(t.id)}
                className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                aria-label="Delete task"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        {visible.length === 0 && (
          <div className="mt-12 text-center text-muted-foreground">
            {todos.length === 0
              ? "Add your first task above ✨"
              : "Nothing here. Switch filters to see more."}
          </div>
        )}

        {todos.some((t) => t.done) && (
          <div className="mt-6 text-center">
            <button
              onClick={clearDone}
              className="text-xs font-medium text-muted-foreground hover:text-destructive"
            >
              Clear completed
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
