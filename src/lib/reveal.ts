import type { CSSProperties } from 'react';

// Position of a block in the page-load reveal sequence (see .reveal in globals.css).
export const at = (i: number) => ({ '--i': i }) as CSSProperties;
