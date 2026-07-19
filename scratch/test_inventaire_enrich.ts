import { enrichWorkMetadata } from "../supabase/functions/_shared/inventaire.ts";

console.log("=== ENRICHING Le Capital au XXIe siècle ===");
try {
  const res = await enrichWorkMetadata("wd:Q15991228");
  console.log("Result:", JSON.stringify(res, null, 2));
} catch (e) {
  console.error("Failed:", e);
}

console.log("\n=== ENRICHING Les Trente Glorieuses ===");
try {
  const res = await enrichWorkMetadata("wd:Q50379158");
  console.log("Result:", JSON.stringify(res, null, 2));
} catch (e) {
  console.error("Failed:", e);
}
