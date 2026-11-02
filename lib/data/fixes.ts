import programmeFixes from "@/data/raw/programme-fixes.json";

// Corrections the site shows before the next database load (data/raw/programmes.json already carries them,
// so a load makes them no-ops): PolyU programme codes that were read as names.

const NAMES = programmeFixes.names as Record<string, string>;

export const fixedName = (id: string, name: string) => NAMES[id] ?? name;
