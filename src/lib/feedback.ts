// Centralized feedback for completion / undo actions:
// - haptic vibration on mobile
// - subtle WebAudio "ding" / "thud"
// - floating XP popup mounted at <body>
// - toast (caller handles via sonner)

import { toast } from "sonner";

const SOUND_KEY = "forge:sound";
const HAPTIC_KEY = "forge:haptic";

export function isSoundEnabled() {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(SOUND_KEY) !== "0";
}
export function setSoundEnabled(v: boolean) {
  localStorage.setItem(SOUND_KEY, v ? "1" : "0");
}
export function isHapticEnabled() {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(HAPTIC_KEY) !== "0";
}
export function setHapticEnabled(v: boolean) {
  localStorage.setItem(HAPTIC_KEY, v ? "1" : "0");
}

let _ctx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!_ctx) {
      const Ctor =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      _ctx = new Ctor();
    }
    return _ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, durMs: number, type: OscillatorType = "sine", gain = 0.06) {
  if (!isSoundEnabled()) return;
  const c = ctx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = 0;
    osc.connect(g);
    g.connect(c.destination);
    const t0 = c.currentTime;
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.02);
  } catch {
    /* ignore */
  }
}

function vibrate(pattern: number | number[]) {
  if (!isHapticEnabled()) return;
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}

function floatXp(amount: number, sign: 1 | -1, originEl?: Element | null) {
  if (typeof document === "undefined") return;
  const node = document.createElement("div");
  node.textContent = `${sign > 0 ? "+" : "−"}${amount} XP`;
  node.className = "forge-xp-popup";
  // Anchor near origin element if provided, else center-top
  let x = window.innerWidth / 2;
  let y = 80;
  if (originEl) {
    const r = originEl.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.dataset.sign = sign > 0 ? "pos" : "neg";
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 1300);
}

export function celebrateXp(opts: {
  amount: number;
  origin?: Element | null;
  message?: string;
}) {
  vibrate([8, 14, 18]);
  tone(523.25, 90, "sine", 0.05); // C5
  setTimeout(() => tone(783.99, 130, "sine", 0.05), 70); // G5
  floatXp(opts.amount, 1, opts.origin);
  toast.success(opts.message ?? `+${opts.amount} XP earned`, { duration: 1800 });
}

export function deductXp(opts: {
  amount: number;
  origin?: Element | null;
  message?: string;
}) {
  vibrate(20);
  tone(220, 140, "sine", 0.04);
  floatXp(opts.amount, -1, opts.origin);
  toast(opts.message ?? `−${opts.amount} XP removed`, { duration: 1500 });
}
