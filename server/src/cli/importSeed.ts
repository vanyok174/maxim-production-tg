import fs from 'fs';
import 'dotenv/config';
import { initDb, getDb } from '../db.js';

const pathArg = process.argv[2];
if (!pathArg) {
  console.error('Usage: importSeed.ts <path-to-seed.json>');
  process.exit(1);
}

const raw = fs.readFileSync(pathArg, 'utf8');
const data = JSON.parse(raw) as {
  employees?: { name: string; productivity?: number }[];
  articles?: {
    name: string;
    payPerUnit?: number;
    planFbsPerDay?: number;
    wbSupplierArticle?: string;
  }[];
};

initDb();
const db = getDb();

const upEmp = db.prepare(
  `INSERT INTO employees (name, productivity_per_day) VALUES (@name, @p)
   ON CONFLICT(name) DO UPDATE SET productivity_per_day = excluded.productivity_per_day`,
);
const upArt = db.prepare(
  `INSERT INTO articles (name, pay_per_unit, plan_fbs_per_day, wb_supplier_article)
   VALUES (@name, @pay, @plan, @wb)
   ON CONFLICT(name) DO UPDATE SET
     pay_per_unit = excluded.pay_per_unit,
     plan_fbs_per_day = excluded.plan_fbs_per_day,
     wb_supplier_article = COALESCE(excluded.wb_supplier_article, articles.wb_supplier_article)`,
);

const tx = db.transaction(() => {
  for (const e of data.employees || []) {
    const name = String(e?.name || '').trim();
    if (!name) continue;
    upEmp.run({ name, p: Number(e.productivity) || 0 });
  }
  for (const a of data.articles || []) {
    const name = String(a?.name || '').trim();
    if (!name) continue;
    upArt.run({
      name,
      pay: Number(a.payPerUnit) || 0,
      plan: Number(a.planFbsPerDay) || 0,
      wb: a.wbSupplierArticle ? String(a.wbSupplierArticle).trim() : null,
    });
  }
});
tx();

console.log('Import OK:', pathArg);
