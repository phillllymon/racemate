import type { NextApiRequest, NextApiResponse } from 'next';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Query your users table (omit password_hash!)
    const users = await sql`
      SELECT id, name, email, created_at
      FROM users
      ORDER BY id ASC
    `;

    res.status(200).json(users);
  } catch (err) {
    console.error('Database query failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}