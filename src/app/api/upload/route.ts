import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { getUserId } from '@/lib/auth';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants';

// Receipts are stored privately under the user's id and served back through /api/files,
// which checks the session. On Vercel they go to Blob storage (the local disk is wiped on
// every deploy); locally they go to data/uploads.
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'File is larger than 10 MB' }, { status: 400 });
  const looksAllowed = ALLOWED_UPLOAD_TYPES.includes(file.type) || /\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(file.name);
  if (!looksAllowed) return NextResponse.json({ error: 'Only images and PDFs are allowed' }, { status: 400 });

  const ext = (path.extname(file.name) || '.jpg').toLowerCase().replace(/[^.a-z0-9]/g, '');
  const key = `receipts/${userId}/${uuid()}${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await put(key, file, { access: 'private', addRandomSuffix: false, contentType: file.type });
  } else {
    const fullPath = path.join(process.cwd(), 'data', 'uploads', key);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, Buffer.from(await file.arrayBuffer()));
  }

  return NextResponse.json({ path: `/api/files/${key}` });
}
