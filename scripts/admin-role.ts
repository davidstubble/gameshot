/**
 * Grant or revoke GameShot admin access (Pro without purchase) for an existing account.
 * The account must have signed in once. Run from the project root:
 *   npx tsx scripts/admin-role.ts list
 *   npx tsx scripts/admin-role.ts grant <email|id>
 *   npx tsx scripts/admin-role.ts revoke <email|id>
 */
import { eq } from 'drizzle-orm';
import { users } from '../drizzle/schema';
import { getDb } from '../server/db';

async function main() {
  const [command, target] = process.argv.slice(2);
  const db = await getDb();
  if (!db) throw new Error('Database is not configured.');
  if (command === 'list') {
    const rows = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn }).from(users);
    console.table(rows.map((row) => ({ ...row, lastSignedIn: row.lastSignedIn?.toISOString() })));
    return;
  }
  if ((command !== 'grant' && command !== 'revoke') || !target) throw new Error('Usage: admin-role.ts list | grant <email|id> | revoke <email|id>');
  const where = /^\d+$/.test(target) ? eq(users.id, Number(target)) : eq(users.email, target);
  const matches = await db.select({ id: users.id, email: users.email }).from(users).where(where);
  if (matches.length !== 1) throw new Error(`Expected exactly one account for ${target}; found ${matches.length}. Sign in once first.`);
  await db.update(users).set({ role: command === 'grant' ? 'admin' : 'user' }).where(eq(users.id, matches[0].id));
  console.log(`${command === 'grant' ? 'Granted' : 'Revoked'} admin for account #${matches[0].id} (${matches[0].email ?? 'no email'}).`);
}

main().then(() => process.exit(0), (error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
