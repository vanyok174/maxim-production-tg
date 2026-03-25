import fs from 'fs';
import 'dotenv/config';
import { initDb, getDb } from '../db.js';

const pathArg = process.argv[2];
if (!pathArg) {
  console.error('Usage: importFullData.ts <path-to-data.json>');
  process.exit(1);
}

const raw = fs.readFileSync(pathArg, 'utf8');
const data = JSON.parse(raw) as {
  assemblies?: {
    assembly_date: string;
    employee_name: string;
    article_name: string;
    qty: number;
    confirmed: boolean;
    pay_per_unit: number;
    amount: number;
  }[];
  shipments?: {
    shipment_type: string;
    shipment_date: string;
    article_name: string;
    qty: number;
  }[];
  schedule?: {
    employee_name: string;
    work_date: string;
    is_working: boolean;
  }[];
};

initDb();
const db = getDb();

const insAssembly = db.prepare(
  `INSERT INTO assemblies (assembly_date, employee_name, article_name, qty, confirmed, pay_per_unit, amount)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);
const insShipment = db.prepare(
  `INSERT INTO shipments (shipment_type, shipment_date, article_name, qty) VALUES (?, ?, ?, ?)`,
);
const insSchedule = db.prepare(
  `INSERT INTO schedule (employee_name, work_date, is_working) VALUES (?, ?, ?)
   ON CONFLICT(employee_name, work_date) DO UPDATE SET is_working = excluded.is_working`,
);

let aCount = 0, sCount = 0, schCount = 0;

const tx = db.transaction(() => {
  if (data.assemblies) {
    for (const a of data.assemblies) {
      if (!a.article_name || !a.assembly_date) continue;
      insAssembly.run(a.assembly_date, a.employee_name || '', a.article_name, a.qty || 0, a.confirmed ? 1 : 0, a.pay_per_unit || 0, a.amount || 0);
      aCount++;
    }
  }
  if (data.shipments) {
    for (const s of data.shipments) {
      if (!s.article_name || !s.shipment_date) continue;
      insShipment.run(s.shipment_type || 'FBO', s.shipment_date, s.article_name, s.qty || 0);
      sCount++;
    }
  }
  if (data.schedule) {
    for (const sc of data.schedule) {
      if (!sc.employee_name || !sc.work_date) continue;
      insSchedule.run(sc.employee_name, sc.work_date, sc.is_working ? 1 : 0);
      schCount++;
    }
  }
});
tx();

console.log(`Import OK: assemblies=${aCount}, shipments=${sCount}, schedule=${schCount}`);
