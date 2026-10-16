import { NextRequest, NextResponse } from 'next/server';
import { getUserId, ownsProject } from '@/lib/auth';
import { connectSheet, disconnectSheet, pullFromSheet, SheetSyncError } from '@/lib/sheet-sync';

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Owner only. POST with url + secret connects the sheet; POST with just projectId syncs now.
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return fail('Unauthorized', 401);

  const body = await req.json();
  if (!(await ownsProject(userId, body.projectId))) return fail('Not found', 404);

  try {
    if (body.url) return NextResponse.json(await connectSheet(body.projectId, String(body.url).trim(), String(body.secret || '').trim()));
    return NextResponse.json(await pullFromSheet(body.projectId, true));
  } catch (e) {
    if (e instanceof SheetSyncError) return fail(e.message, 502);
    throw e;
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return fail('Unauthorized', 401);

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!(await ownsProject(userId, projectId))) return fail('Not found', 404);

  await disconnectSheet(projectId!);
  return NextResponse.json({ success: true });
}

// Google Sheets calls can take a few seconds each.
export const maxDuration = 60;
