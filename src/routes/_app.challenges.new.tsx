import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/challenges/new")({
  head: () => ({ meta: [{ title: "New Challenge — Forge" }] }),
  component: NewChallenge,
});

function NewChallenge() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(in30);
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const [goal, setGoal] = useState(1);
  const [unit, setUnit] = useState("check-in");
  const [isPublic, setIsPublic] = useState(true);
  const [maxOn, setMaxOn] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [saving, setSaving] = useState(false);

  async function create() {
    if (name.trim().length < 3) return toast.error("Name must be at least 3 characters");
    if (endDate < startDate) return toast.error("End date must be after start date");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in first");
      navigate({ to: "/auth", search: { mode: "signin" } });
      return;
    }
    const { data, error } = await supabase
      .from("challenges")
      .insert({
        created_by: user.id,
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        cadence,
        goal_per_period: Math.max(1, goal),
        goal_unit: unit.trim() || "check-in",
        is_public: isPublic,
        max_participants: maxOn ? Math.max(2, maxParticipants) : null,
      })
      .select("id")
      .single();
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    // Auto-join creator
    await supabase.from("challenge_participants").insert({ challenge_id: data!.id, user_id: user.id });
    toast.success("Challenge created!");
    navigate({ to: "/challenges/$id", params: { id: data!.id } });
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <Link to="/challenges" className="rounded-lg p-2 hover:bg-card/60"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-2xl font-bold">New Challenge</h1>
      </div>

      <div className="space-y-4 rounded-2xl border border-border p-4" style={{ background: "var(--gradient-card)" }}>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            placeholder="30-Day Push-Up Challenge" />
        </Field>
        <Field label="Description (optional)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            placeholder="What's the goal? Any rules?" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></Field>
          <Field label="End"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></Field>
        </div>

        <Field label="Cadence">
          <div className="grid grid-cols-2 gap-2">
            {(["daily", "weekly"] as const).map((c) => (
              <button key={c} onClick={() => setCadence(c)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-all ${
                  cadence === c ? "border-primary text-primary-foreground" : "border-border text-muted-foreground"
                }`}
                style={cadence === c ? { background: "var(--gradient-primary)" } : {}}>
                {c}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Goal per ${cadence === "daily" ? "day" : "week"}`}>
            <input type="number" min={1} value={goal} onChange={(e) => setGoal(parseInt(e.target.value) || 1)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label="Unit">
            <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={30}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="reps, miles, pages" />
          </Field>
        </div>

        <Field label="Visibility">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setIsPublic(true)}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                isPublic ? "border-primary text-primary-foreground" : "border-border text-muted-foreground"
              }`}
              style={isPublic ? { background: "var(--gradient-primary)" } : {}}>
              <Globe className="h-4 w-4" /> Public
            </button>
            <button onClick={() => setIsPublic(false)}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                !isPublic ? "border-primary text-primary-foreground" : "border-border text-muted-foreground"
              }`}
              style={!isPublic ? { background: "var(--gradient-primary)" } : {}}>
              <Lock className="h-4 w-4" /> Private
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isPublic ? "Anyone can find and join." : "Only people with the invite code can join."}
          </p>
        </Field>

        <Field label="Participant limit">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={maxOn} onChange={(e) => setMaxOn(e.target.checked)} className="accent-primary" />
            Set a maximum number of participants
          </label>
          {maxOn && (
            <input type="number" min={2} value={maxParticipants} onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 2)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          )}
        </Field>

        <button onClick={create} disabled={saving}
          className="w-full rounded-xl py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
          {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Create Challenge"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
