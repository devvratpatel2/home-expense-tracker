// Ported from build-tracker: reads the builder quote sheet (Item, Cost) and maps its
// loosely-typed line items onto the draw-schedule category names.
export function isBudgetHeaderRow(row: string[] | undefined): boolean {
  if (!row || row.length < 2) return false;
  const item = String(row[0] ?? "").trim().toLowerCase();
  const cost = String(row[1] ?? "").trim().toLowerCase();
  if (!item || !cost) return false;
  if (item === "item" || item === "category" || item === "name") return true;
  if (cost === "cost" || cost === "amount" || cost === "budget" || cost === "price") return true;
  return false;
}

export function normalizeBudgetCategory(raw: string): string {
  const collapsed = raw.toLowerCase().replace(/\s+/g, " ").trim();
  const fuzzy: Array<[RegExp, string]> = [
    [/^deposit/, "Deposit (10%)"],
    [/^permit.*(insurance|survey|suvery|impact)/, "Permit / Insurance / Impact / Survey"],
    [/^site work/, "Site Work / Cleaning / Grading"],
    [/^footings?\b|foundation|\bslab\b/, "Footings / Foundation / Slab"],
    [/^framing.*(floors?|sub ?floors?)/, "Framing: Floors / Sub Floors"],
    [/^framing.*\bstu/, "Framing: O/S and I/S Studs"],
    [/^framing.*ceiling.*wall.*sheathing/, "Framing: Ceiling and Wall Sheathing"],
    [/^framing.*roof.*sheathing/, "Framing: Roof and Roof Sheathing"],
    [/^finish roof|^roof materials/, "Finish Roof Materials"],
    [/^plumbing rough/, "Plumbing Rough In (incl. tub/shower inserts)"],
    [/^electrical rough/, "Electrical Rough In (incl. low voltage)"],
    [/^hvac roug/, "HVAC Rough In"],
    [/^insulation/, "Insulation"],
    [/^fireplace/, "Fireplace"],
    [/^(exterior )?doors? (and|&) windows?/, "Exterior Doors and Windows"],
    [/^exterior siding|^siding/, "Exterior Siding"],
    [/^exterior trim/, "Exterior Trim"],
    [/^sheetrock.*hang/, "Sheetrock / Drywall Hang"],
    [/^sheetrock.*finish/, "Sheetrock / Drywall Finish"],
    [/^exterior paint/, "Exterior Paint Complete"],
    [/^interior trim/, "Interior Trim"],
    [/^interior doors?/, "Interior Doors"],
    [/^cabinets?/, "Cabinets / Countertops"],
    [/^tile.*vinyl|^tile|vinyl.*kitchen/, "Tile / Vinyl (Kitchen & Bath)"],
    [/^septic|sewer|well/, "Septic / Sewer / Well / Water Meter"],
    [/^hvac finish/, "HVAC Finish & Units Set"],
    [/^concrete drive|concrete porch/, "Concrete Drive & Concrete Porches"],
    [/^interior paint primed/, "Interior Paint: Primed"],
    [/^interior paint finish/, "Interior Paint: Finished"],
    [/^plumbing fixtures?/, "Plumbing Fixtures Set"],
    [/^electrical fixtures?/, "Electrical Fixtures Set"],
    [/^porches?.*decks?/, "Porches & Decks (wood)"],
    [/^finished carpet|^carpet.*floor/, "Finished Carpet & Floors"],
    [/^appli/, "Appliances"],
    [/^gutters?/, "Gutters & Downspouts"],
    [/^finished grading|grading.*seeding/, "Finished Grading & Seeding"],
    [/^garage doors?/, "Garage Doors"],
  ];
  for (const [re, name] of fuzzy) {
    if (re.test(collapsed)) return name;
  }
  return raw;
}
