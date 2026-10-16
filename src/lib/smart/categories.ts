export const SUPPLEMENTAL_CATEGORIES = [
  "Land Purchase",
  "Design & Engineering",
  "Financing",
  "Property Tax",
  "GC / Consulting",
  "Smart Home / Network",
  "Waste Disposal",
] as const;

export const UNCATEGORIZED = "Uncategorized";

export type CategoryRule = {
  category: string;
  keywords: string[];
};

export const CATEGORY_RULES: CategoryRule[] = [
  { category: "Land Purchase", keywords: ["land purchase"] },
  {
    category: "Design & Engineering",
    keywords: [
      "robert architect",
      "robert wanthouse",
      "fletcher engineer",
      "fletcher",
      "architect",
      "engineer",
      "soil erosion",
      "sediment control",
      "brunswick surveying",
      "survey",
      "design",
    ],
  },
  {
    category: "Permit / Insurance / Impact / Survey",
    keywords: [
      "zoning permit",
      "co inspection",
      "development fee",
      "construction permit",
      "builders risk",
      "builder's risk",
      "premisis liability",
      "premises liability",
      "insurance",
      "permit",
    ],
  },
  {
    category: "Financing",
    keywords: ["citizens bank", "td bank", "appraisal", "closing", "report fees"],
  },
  { category: "Property Tax", keywords: ["sayreville tax", "property tax"] },
  { category: "Waste Disposal", keywords: ["sidabi", "waste disposal", "dumpster"] },
  {
    category: "Site Work / Cleaning / Grading",
    keywords: ["water department", "trees and driveway", "site work", "clearing", "grading"],
  },
  {
    category: "Footings / Foundation / Slab",
    keywords: ["foundation", "vda construction", "vda ", "water proof", "waterproof", "mojave desert", "slab", "footing"],
  },
  {
    category: "Framing: Floors / Sub Floors",
    keywords: ["sole construction first floor", "subfloor", "sub floor", "sub-floor"],
  },
  {
    category: "Framing: O/S and I/S Studs",
    keywords: ["framing construction", "windows framing", "stud", "selvin santos"],
  },
  {
    category: "Framing: Ceiling and Wall Sheathing",
    keywords: ["wall sheathing", "ceiling sheathing", "tyvek"],
  },
  {
    category: "Framing: Roof and Roof Sheathing",
    keywords: ["roof sheathing"],
  },
  {
    category: "Finish Roof Materials",
    keywords: ["roof shingles", "roofing material", "roofing labor", "best supply", "abc supply co", "shingles"],
  },
  {
    category: "Plumbing Rough In (incl. tub/shower inserts)",
    keywords: ["plumbing", "juan antonio", "plumbing supplies", "plumbing part", "tub", "shower"],
  },
  {
    category: "Electrical Rough In (incl. low voltage)",
    keywords: ["electric work", "felix", "fm electrics", "electrical rough"],
  },
  {
    category: "HVAC Rough In",
    keywords: ["bryan heating", "hvac"],
  },
  {
    category: "Insulation",
    keywords: ["insulation"],
  },
  {
    category: "Fireplace",
    keywords: ["fireplace", "chimney"],
  },
  {
    category: "Exterior Doors and Windows",
    keywords: [
      "windows, exterior doors",
      "windows for",
      "windows related supplies",
      "in-law windows",
      "exterior door",
      "entrance door",
      "windows and tiles",
    ],
  },
  {
    category: "Exterior Siding",
    keywords: [
      "abc supply for sidings",
      "siding materials",
      "best option ep",
      "board and batten",
      "sidings (back",
      "siding",
    ],
  },
  {
    category: "Exterior Trim",
    keywords: ["exterior trim"],
  },
  {
    category: "Sheetrock / Drywall Hang",
    keywords: ["drywall hang", "sheetrock hang"],
  },
  {
    category: "Sheetrock / Drywall Finish",
    keywords: ["drywall finish", "sheetrock finish"],
  },
  {
    category: "Exterior Paint Complete",
    keywords: ["exterior paint"],
  },
  {
    category: "Interior Trim",
    keywords: ["pu molding", "panels and trim", "moldings"],
  },
  {
    category: "Interior Doors",
    keywords: ["interior doors"],
  },
  {
    category: "Cabinets / Countertops",
    keywords: ["kitchen cabinets", "wardrobes", "cabinet", "countertop"],
  },
  {
    category: "Tile / Vinyl (Kitchen & Bath)",
    keywords: ["spc flooring", "spc, lighting", "tile", "vinyl"],
  },
  {
    category: "Septic / Sewer / Well / Water Meter",
    keywords: ["septic", "sewer", "well water", "water meter"],
  },
  {
    category: "HVAC Finish & Units Set",
    keywords: ["hvac finish", "panasonic whisper", "bathroom fans"],
  },
  {
    category: "Concrete Drive & Concrete Porches",
    keywords: ["jc stone", "stone and stucco", "concrete drive", "concrete porch", "garage and entrance slab"],
  },
  {
    category: "Interior Paint: Primed",
    keywords: ["primed paint", "interior paint primed"],
  },
  {
    category: "Interior Paint: Finished",
    keywords: ["interior paint finished"],
  },
  {
    category: "Plumbing Fixtures Set",
    keywords: ["shower heads", "shower jets", "bathroom items", "safety box", "toilet"],
  },
  {
    category: "Electrical Fixtures Set",
    keywords: ["recessed lights", "lighting", "doorbell", "doorbell camera"],
  },
  {
    category: "Porches & Decks (wood)",
    keywords: [
      "jj elite carpentery",
      "jj elite carpentry",
      "basement stairs",
      "main stairs",
      "side stairs",
      "wood/paneling",
      "wood/plumbing",
      "wood haven",
      "woodhaven lumber",
      "additional lumber",
      "porch",
      "deck",
    ],
  },
  {
    category: "Finished Carpet & Floors",
    keywords: ["floors kitchen", "carpet", "spc floor"],
  },
  {
    category: "Appliances",
    keywords: ["fridge", "refrigerator", "oven", "stove", "dishwasher", "appliance", "microwave"],
  },
  {
    category: "Gutters & Downspouts",
    keywords: ["gutter", "downspout"],
  },
  {
    category: "Finished Grading & Seeding",
    keywords: ["finished grading", "seeding"],
  },
  {
    category: "Garage Doors",
    keywords: ["garage door"],
  },
  {
    category: "Smart Home / Network",
    keywords: [
      "access point",
      "ubiquiti",
      "unifi",
      "ring",
      "nest",
      "smart switch",
      "wifi",
      "wi-fi",
      "ethernet",
      "poe",
      "smart home",
      "exterior light",
      "smart light",
    ],
  },
  {
    category: "GC / Consulting",
    keywords: [
      "consulting fee",
      "consultancy fee",
      "consulting and material",
      "shailesh uncle for ibr",
      "shailesh uncle for vda",
      "ibr construction",
      "vda construction",
    ],
  },
];

export function ruleBasedCategorize(description: string): {
  category: string;
  matchedKeyword: string | null;
} {
  const text = description.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) {
        return { category: rule.category, matchedKeyword: kw };
      }
    }
  }
  return { category: UNCATEGORIZED, matchedKeyword: null };
}
