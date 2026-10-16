const KNOWN_VENDORS = [
  "Shailesh Uncle",
  "Robert Architect",
  "Robert Wanthouse",
  "Fletcher Engineer",
  "Fletcher",
  "Brunswick Surveying",
  "Mojave Desert",
  "George Construction",
  "Sole Construction",
  "Selvin Santos",
  "JJ Elite Carpentry",
  "Juan Antonio",
  "Felix",
  "FM Electrics",
  "Bryan Heating",
  "ABC Supply",
  "Best Supply",
  "Best Option EP",
  "JC Stone",
  "Woodhaven Lumber",
  "Wood Haven",
  "Home Depot",
  "Amazon",
  "Citizens Bank",
  "TD Bank",
  "Victory Insurance",
  "Sidabi Waste Disposal",
  "Sidabi",
  "Sayreville Tax",
  "Water Department",
  "China",
];

export function extractVendor(description: string): string {
  const text = description;
  for (const vendor of KNOWN_VENDORS) {
    if (text.toLowerCase().includes(vendor.toLowerCase())) {
      return vendor;
    }
  }
  const givenToMatch = description.match(/given to ([A-Z][A-Za-z .]+?)(?: for | as | via |,|$)/i);
  if (givenToMatch) {
    return givenToMatch[1].trim();
  }
  const paidToMatch = description.match(/paid (?:for |to )?([A-Z][A-Za-z .]+?)(?: for | as |,|$)/i);
  if (paidToMatch) {
    return paidToMatch[1].trim();
  }
  return "";
}
