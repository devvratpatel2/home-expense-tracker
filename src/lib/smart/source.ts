export type ExpenseSource = "Owner" | "Builder" | "Unknown";

const OWNER_HINTS = [
  "home depot",
  "amazon",
  "woodhaven",
  "wood haven",
  "abc supply",
  "best supply",
  "best option",
  "general plumbing supplies",
  "panasonic",
  "shower heads",
  "recessed lights",
  "balance payment to china",
  "delivery fee to china",
  "china material",
  "china for",
];

const BUILDER_HINTS = [
  "given to shailesh uncle",
  "shailesh uncle for",
  "vda construction",
  "ibr construction",
  "george construction",
  "sole construction",
  "juan antonio",
  "felix",
  "fm electrics",
  "bryan heating",
  "jj elite",
  "jc stone",
  "consulting fee",
  "consultancy fee",
];

export function inferSource(description: string): ExpenseSource {
  const text = description.toLowerCase();
  for (const hint of OWNER_HINTS) {
    if (text.includes(hint)) return "Owner";
  }
  for (const hint of BUILDER_HINTS) {
    if (text.includes(hint)) return "Builder";
  }
  return "Unknown";
}
