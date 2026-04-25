import "dotenv/config";
import { SignJWT } from "jose";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const [admin] = await sql`SELECT id, username, role, player_id FROM super_admins WHERE username='admin' LIMIT 1`;
if (!admin) throw new Error("admin not found");
const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
const jwt = await new SignJWT({
  adminId: admin.id,
  username: admin.username,
  role: admin.role,
  playerId: admin.player_id,
}).setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
  .sign(secret);
console.log(jwt);
