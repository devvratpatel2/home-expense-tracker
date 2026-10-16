import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { getDb, initDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { key: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const result = await getDb().execute({ sql: `SELECT content_type, data FROM files WHERE key = ? AND user_id = ?`, args: [params.key, userId] });
  const row = result.rows[0];
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return new NextResponse(row.data as ArrayBuffer, {
    headers: { 'Content-Type': row.content_type as string, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
  });
}
