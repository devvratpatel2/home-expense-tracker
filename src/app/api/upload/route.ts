import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { getUserId } from '@/lib/auth';
import { getDb, initDb } from '@/lib/db';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants';

// Receipts are stored in the database so nothing extra has to be set up on Vercel
// (its disk is wiped on every deploy). They are served back through /api/files to their owner only.
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'File is larger than 4 MB' }, { status: 400 });

  const ext = (path.extname(file.name) || '.jpg').toLowerCase().replace(/[^.a-z0-9]/g, '');
  const contentType = ALLOWED_UPLOAD_TYPES.includes(file.type) ? file.type : ({ '.pdf': 'application/pdf', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' } as Record<string, string>)[ext];
  if (!contentType) return NextResponse.json({ error: 'Only images and PDFs are allowed' }, { status: 400 });

  const key = `${uuid()}${ext}`;
  await initDb();
  await getDb().execute({
    sql: `INSERT INTO files (key, user_id, content_type, data) VALUES (?, ?, ?, ?)`,
    args: [key, userId, contentType, new Uint8Array(await file.arrayBuffer())],
  });

  return NextResponse.json({ path: `/api/files/${key}` });
}
