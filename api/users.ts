import type { NextApiRequest, NextApiResponse } from 'next';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const users = await sql`
      SELECT id, name, email, created_at
      FROM users
      ORDER BY id ASC
    `;

    // res.status(200).json(users);
    res.status(200).json(["poop", "poopyface"]);
  } catch (err: any) {
    // Log the full error so you can see what failed
    console.error('Database query failed:', err);

    // Include more info for debugging (optional)
    if (err?.message) {
      return res.status(500).json({ error: err.message });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
}