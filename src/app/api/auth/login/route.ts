import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  await initDb();
  const db = getDb();
  const result = await db.execute({ sql: `SELECT id, name, password FROM users WHERE email = ?`, args: [email] });

  if (!result.rows.length) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const row = result.rows[0];
  if (!bcrypt.compareSync(password, row.password as string)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.userId = row.id as string;
  session.email = email;
  session.name = row.name as string;
  await session.save();

  return NextResponse.json({ success: true, name: row.name });
}
