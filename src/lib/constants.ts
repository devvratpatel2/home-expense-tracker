export const DEFAULT_CATEGORIES = [
  'Foundation & Excavation',
  'Framing & Structure',
  'Roofing',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Insulation',
  'Drywall & Painting',
  'Flooring',
  'Windows & Doors',
  'Kitchen & Cabinets',
  'Bathrooms',
  'Exterior & Landscaping',
  'Permits & Fees',
  'Contractor Labor',
  'Materials',
  'Miscellaneous',
];

export const CONSTRUCTION_PHASES = [
  'Planning & Permits',
  'Site Preparation',
  'Foundation',
  'Framing',
  'Roofing',
  'Rough Plumbing & Electrical',
  'Insulation & Drywall',
  'Interior Finishes',
  'Exterior Finishes',
  'Final Inspections',
  'Move-in Ready',
];

export const PAYMENT_METHODS = ['Cash', 'Check', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Zelle', 'Other'];

export const PAID_BY = ['Owner', 'Builder'];

// Vercel rejects request bodies over 4.5 MB, so photos are shrunk in the browser before upload.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'application/pdf'];
