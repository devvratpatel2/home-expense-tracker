import { NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import fs from 'fs';
import path from 'path';
import { getUserId } from '@/lib/auth';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.heic': 'image/heic', '.heif': 'image/heif', '.pdf': 'application/pdf',
};

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Paths look like receipts/<userId>/<file>; only the owner can read their own files.
  const parts = params.path || [];
  if (parts.length !== 3 || parts[0] !== 'receipts' || parts[1] !== userId || parts.some(p => p.includes('..'))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const key = parts.join('/');

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const result = await get(key, { access: 'private' });
    if (!result || result.statusCode !== 200) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return new NextResponse(result.stream, { headers: { 'Content-Type': result.blob.contentType, 'Cache-Control': 'private, max-age=3600' } });
  }

  const fullPath = path.join(process.cwd(), 'data', 'uploads', key);
  if (!fs.existsSync(fullPath)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const type = CONTENT_TYPES[path.extname(fullPath).toLowerCase()] || 'application/octet-stream';
  return new NextResponse(fs.readFileSync(fullPath), { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600' } });
}
