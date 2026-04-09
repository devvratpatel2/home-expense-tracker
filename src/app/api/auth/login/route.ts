import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const db = await getDb();
  const result = db.exec(`SELECT id, name, password FROM users WHERE email = '${email.replace(/'/g, "''")}'`);

  if (!result.length || !result[0].values.length) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const [id, name, hash] = result[0].values[0] as string[];
  if (!bcrypt.compareSync(password, hash)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.userId = id;
  session.email = email;
  session.name = name;
  await session.save();

  return NextResponse.json({ success: true, name });
}
