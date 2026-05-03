/**
 * Edge Function: /auth
 * Handles: POST /auth/login, POST /auth/register, POST /auth/check-email
 */
// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore deno
import { hash, compare } from 'npm:bcryptjs';
import { handleCors, json, error } from '../_shared/cors.ts';
import { sql } from '../_shared/db.ts';
import { signJwt, JWT_SECRET } from '../_shared/auth.ts';

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^(?:\/functions\/v1)?\/auth/, '');

  try {
    // POST /auth/check-email
    if (req.method === 'POST' && path === '/check-email') {
      const { email } = await req.json();
      if (!email) return error('Email is required', 400);
      const rows = await sql`SELECT id FROM "User" WHERE email = ${email} LIMIT 1`;
      return json({ exists: rows.length > 0 });
    }

    // POST /auth/register
    if (req.method === 'POST' && path === '/register') {
      const { email, password, username, name } = await req.json();
      if (!email || !password || !username) {
        return error('Email, password and username are required', 400);
      }

      const sanitizedUsername = username.startsWith('@') ? username.slice(1) : username;

      const existing = await sql`
        SELECT id FROM "User" WHERE email = ${email} OR username = ${sanitizedUsername} LIMIT 1
      `;
      if (existing.length > 0) {
        return error('User already exists with this email or username', 400);
      }

      const hashedPassword = await hash(password, 10);
      const rows = await sql`
        INSERT INTO "User" (email, password, username, name, followers, following)
        VALUES (${email}, ${hashedPassword}, ${sanitizedUsername}, ${name || sanitizedUsername}, 0, 0)
        RETURNING id, email, username, name, image, bio, website
      `;
      const user = rows[0];

      const token = await signJwt({ id: user.id, email: user.email, username: user.username }, JWT_SECRET);
      return json({ user, token }, 201);
    }

    // POST /auth/login
    if (req.method === 'POST' && path === '/login') {
      const { email, password } = await req.json();
      if (!email || !password) return error('Email and password are required', 400);

      const rows = await sql`SELECT * FROM "User" WHERE email = ${email} LIMIT 1`;
      if (!rows.length) return error('Invalid email or password', 401);

      const user = rows[0];
      const valid = await compare(password, user.password);
      if (!valid) return error('Invalid email or password', 401);

      const token = await signJwt({ id: user.id, email: user.email, username: user.username }, JWT_SECRET);
      const { password: _, ...userWithoutPassword } = user;
      return json({ user: userWithoutPassword, token });
    }

    return error('Not found', 404);
  } catch (e) {
    console.error('[auth]', e);
    return error('Internal server error');
  }
});
