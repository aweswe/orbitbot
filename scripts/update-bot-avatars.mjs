// Update bot avatars to use Orbit astronaut theme
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname2 = dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);
const pg = _require('C:/Users/adars/.gemini/antigravity/scratch/orbit-bot/node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/index.js');

const envFile = resolve(__dirname2, '../.env');
const envVars = readFileSync(envFile, 'utf-8')
  .split('\n')
  .filter(l => l.includes('=') && !l.startsWith('#'))
  .reduce((acc, l) => {
    const eq = l.indexOf('=');
    const k = l.slice(0, eq).trim();
    let v = l.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    acc[k] = v;
    return acc;
  }, {});

const pool = new pg.Pool({ connectionString: envVars.DATABASE_URL });

try {
  // Set search path
  await pool.query('SET search_path TO public');
  
  const schemas = await pool.query("SELECT schemaname, tablename FROM pg_tables WHERE tablename = 'bot'");
  console.log('bot table schemas:', schemas.rows);
  
  const bots = await pool.query('SELECT id, name, color FROM bot ORDER BY created_at');
  console.log('Current bots:', bots.rows);
  
  const astroColors = [
    'orbit-astro::0::#312e81',  // indigo - classic visor
    'orbit-astro::1::#1a237e',  // deep blue - spacewalker
    'orbit-astro::2::#004d40',  // teal - floating
    'orbit-astro::3::#1b5e20',  // green - alien
    'orbit-astro::4::#b71c1c',  // red - rocket
    'orbit-astro::5::#263238',  // slate - robot
  ];
  
  for (let i = 0; i < bots.rows.length; i++) {
    const bot = bots.rows[i];
    const newColor = astroColors[i % astroColors.length];
    await pool.query('UPDATE bot SET color = $1 WHERE id = $2', [newColor, bot.id]);
    console.log(`Updated bot "${bot.name}" (${bot.id}) -> ${newColor}`);
  }
  
  const updated = await pool.query('SELECT id, name, color FROM bot');
  console.log('\nUpdated bots:', updated.rows);
} finally {
  await pool.end();
}
