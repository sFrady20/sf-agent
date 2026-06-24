import { defineTool } from "eve/tools";
import { z } from "zod";

// Camelot wheel: which keys blend harmonically with a given key.
const CAMELOT_TO_KEY: Record<string, string> = {
  "1A": "Abm", "1B": "B", "2A": "Ebm", "2B": "Gb", "3A": "Bbm", "3B": "Db",
  "4A": "Fm", "4B": "Ab", "5A": "Cm", "5B": "Eb", "6A": "Gm", "6B": "Bb",
  "7A": "Dm", "7B": "F", "8A": "Am", "8B": "C", "9A": "Em", "9B": "G",
  "10A": "Bm", "10B": "D", "11A": "F#m", "11B": "A", "12A": "C#m", "12B": "E",
};

const KEY_TO_CAMELOT: Record<string, string> = {};
for (const [camelot, key] of Object.entries(CAMELOT_TO_KEY)) {
  KEY_TO_CAMELOT[key.toLowerCase()] = camelot;
}
Object.assign(KEY_TO_CAMELOT, {
  "g#m": "1A", "d#m": "2A", "a#m": "3A", gbm: "11A", dbm: "12A",
  "f#": "2B", "c#": "3B", "g#": "4B", "d#": "5B", "a#": "6B",
});

function toCamelot(input: string): string | null {
  const raw = input.trim();
  if (/^(1[0-2]|[1-9])[abAB]$/.test(raw)) return raw.toUpperCase();
  const norm = raw
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace("minor", "m")
    .replace("major", "")
    .replace("maj", "")
    .replace("min", "m");
  return KEY_TO_CAMELOT[norm] ?? null;
}

const wrap = (n: number) => ((n - 1 + 12) % 12) + 1;

export default defineTool({
  description:
    "Find DJ keys that mix harmonically with a track's key (Camelot wheel). Accepts a Camelot code ('8A') or a musical key ('Am', 'C major').",
  inputSchema: z.object({
    key: z.string().min(1).describe("Camelot code like '8A', or a musical key like 'Am' / 'C'."),
  }),
  async execute({ key }) {
    const camelot = toCamelot(key);
    if (!camelot) {
      return { error: `Couldn't parse key "${key}". Use a Camelot code (e.g. 8A) or a musical key (e.g. Am, C).` };
    }
    const num = Number.parseInt(camelot, 10);
    const letter = camelot.slice(-1) as "A" | "B";
    const other = letter === "A" ? "B" : "A";

    const matches = [
      { camelot: `${num}${letter}`, relationship: "same key (perfect blend)" },
      { camelot: `${num}${other}`, relationship: "relative major/minor (mood shift)" },
      { camelot: `${wrap(num - 1)}${letter}`, relationship: "-1 (smooth, lower energy)" },
      { camelot: `${wrap(num + 1)}${letter}`, relationship: "+1 (lift energy)" },
    ].map((m) => ({ ...m, key: CAMELOT_TO_KEY[m.camelot] }));

    return { input: { camelot, key: CAMELOT_TO_KEY[camelot] }, matches };
  },
});
