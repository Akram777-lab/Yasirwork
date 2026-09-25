import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";
import fs from "node:fs";

const env = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
const url = /DATABASE_URL\s*=\s*"?([^"\n]+)"?/.exec(env)?.[1] ?? process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: url });

function hash(pw) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}

const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => iso(new Date(Date.now() - n * 864e5));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.round((Math.random() * (max - min) + min) * 100) / 100;

async function main() {
  const existing = await pool.query("select count(*)::int as c from users");
  if (existing.rows[0].c > 0) {
    console.log("Database already seeded, skipping.");
    await pool.end();
    return;
  }

  const people = [
    ["Amelia Hart", "admin@worktrack.app", "admin123", "admin", "Operations Director", "Management"],
    ["Daniel Okafor", "manager@worktrack.app", "manager123", "manager", "Finance Manager", "Finance"],
    ["Sara Lindqvist", "sara@worktrack.app", "employee123", "employee", "Account Executive", "Sales"],
    ["Marcus Reid", "marcus@worktrack.app", "employee123", "employee", "Field Technician", "Operations"],
  ];
  const userIds = [];
  for (const [name, email, pw, role, title, dept] of people) {
    const r = await pool.query(
      `insert into users (name, email, password_hash, role, job_title, department) values ($1,$2,$3,$4,$5,$6) returning id`,
      [name, email, hash(pw), role, title, dept],
    );
    userIds.push(r.rows[0].id);
  }

  const cats = [
    ["Office Supplies", "expense", "#6366f1"],
    ["Travel & Transport", "expense", "#f59e0b"],
    ["Meals & Entertainment", "expense", "#ef4444"],
    ["Utilities", "expense", "#0ea5e9"],
    ["Software & Subscriptions", "expense", "#8b5cf6"],
    ["Marketing", "expense", "#ec4899"],
    ["Client Payment", "income", "#22c55e"],
    ["Product Sales", "income", "#10b981"],
    ["Consulting", "income", "#84cc16"],
    ["Client Meeting", "work", "#3b82f6"],
    ["Development", "work", "#a855f7"],
    ["Admin Work", "work", "#64748b"],
    ["Site Visit", "work", "#f97316"],
  ];
  const catIds = {};
  for (const [name, type, color] of cats) {
    const r = await pool.query(`insert into categories (name, type, color) values ($1,$2,$3) returning id`, [name, type, color]);
    catIds[name] = r.rows[0].id;
  }

  const expenseTitles = [
    ["Printer toner & paper", "Office Supplies", "PaperPlus"],
    ["Team taxi to client site", "Travel & Transport", "CityCabs"],
    ["Client lunch meeting", "Meals & Entertainment", "Bistro 21"],
    ["Monthly electricity bill", "Utilities", "PowerGrid Co."],
    ["Project management licences", "Software & Subscriptions", "Linear"],
    ["Google Ads campaign", "Marketing", "Google"],
    ["Fuel for service van", "Travel & Transport", "ShellStation"],
    ["Coffee & pantry supplies", "Office Supplies", "BeanHub"],
    ["Cloud hosting", "Software & Subscriptions", "AWS"],
    ["Trade show booth", "Marketing", "ExpoWorks"],
  ];
  const incomeTitles = [
    ["Retainer — Northwind Ltd", "Client Payment"],
    ["Invoice #1042 settled", "Client Payment"],
    ["Hardware bundle sale", "Product Sales"],
    ["Advisory workshop", "Consulting"],
  ];
  const payments = ["cash", "card", "bank_transfer", "mobile_wallet", "cheque"];
  const statuses = ["approved", "approved", "approved", "pending", "rejected"];

  for (let i = 0; i < 90; i++) {
    const day = daysAgo(Math.floor(Math.random() * 170));
    if (Math.random() < 0.72) {
      const [title, cat, vendor] = pick(expenseTitles);
      await pool.query(
        `insert into transactions (type,title,amount,txn_date,category_id,user_id,payment_method,vendor,reference,status,notes)
         values ('expense',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [title, rand(25, 1800), day, catIds[cat], pick(userIds), pick(payments), vendor, `INV-${1000 + i}`, pick(statuses), null],
      );
    } else {
      const [title, cat] = pick(incomeTitles);
      await pool.query(
        `insert into transactions (type,title,amount,txn_date,category_id,user_id,payment_method,vendor,reference,status)
         values ('income',$1,$2,$3,$4,$5,'bank_transfer',$6,$7,'approved')`,
        [title, rand(800, 9500), day, catIds[cat], pick(userIds), "Client", `REC-${2000 + i}`],
      );
    }
  }

  const workTitles = [
    ["Quarterly budget review", "Admin Work", "Internal"],
    ["Onboarding call with Northwind", "Client Meeting", "Northwind"],
    ["Shipped invoicing module", "Development", "WorkTrack Core"],
    ["Equipment installation at depot", "Site Visit", "Depot Rollout"],
    ["Prepared expense reconciliation", "Admin Work", "Finance"],
    ["Sprint planning & estimates", "Development", "WorkTrack Core"],
    ["Follow-up demo with Halcyon", "Client Meeting", "Halcyon"],
  ];
  for (let i = 0; i < 70; i++) {
    const [title, cat, project] = pick(workTitles);
    await pool.query(
      `insert into work_logs (user_id, log_date, title, description, project, hours, category_id, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        pick(userIds),
        daysAgo(Math.floor(Math.random() * 60)),
        title,
        "Logged automatically from the daily work journal.",
        project,
        rand(0.5, 8),
        catIds[cat],
        pick(["completed", "completed", "in_progress", "planned"]),
      ],
    );
  }

  const taskRows = [
    ["Collect receipts for Q2 audit", "high", "in_progress", 4, 9],
    ["Follow up with Northwind on invoice #1042", "urgent", "todo", 1, 3],
    ["Renew software subscriptions", "medium", "todo", 12, null],
    ["Review employee expense submissions", "high", "in_progress", 2, 5],
    ["Prepare monthly financial summary", "medium", "todo", 7, null],
    ["Update travel reimbursement policy", "low", "blocked", 20, 25],
    ["Close out depot rollout project", "medium", "done", -3, null],
    ["Schedule team productivity review", "low", "todo", 15, 18],
    ["Reconcile petty cash box", "medium", "done", -8, null],
    ["Negotiate vendor discount with PaperPlus", "high", "todo", 6, 10],
  ];
  for (const [title, priority, status, dueIn, followIn] of taskRows) {
    await pool.query(
      `insert into tasks (title, description, assignee_id, created_by_id, due_date, follow_up_date, priority, status, completed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        title,
        "Auto-generated sample task for demonstration.",
        pick(userIds),
        userIds[0],
        daysAgo(-dueIn),
        followIn ? daysAgo(-followIn) : null,
        priority,
        status,
        status === "done" ? new Date() : null,
      ],
    );
  }

  const settings = [
    ["appName", "WorkTrack"],
    ["appSubtitle", "Expense & Daily Work Management System"],
    ["currency", "USD"],
    ["locale", "en-US"],
    ["companyName", "Northstar Operations"],
    ["fiscalStartMonth", "1"],
    ["requireApproval", "true"],
  ];
  for (const [k, v] of settings) {
    await pool.query(`insert into app_settings (key, value) values ($1,$2) on conflict (key) do nothing`, [k, v]);
  }

  const actions = [
    ["create", "transaction", "Recorded expense \"Client lunch meeting\""],
    ["approved", "transaction", "Approved expense \"Cloud hosting\""],
    ["create", "work_log", "Logged work \"Sprint planning & estimates\""],
    ["create", "task", "Created task \"Collect receipts for Q2 audit\""],
    ["update", "settings", "Updated application settings"],
    ["login", "user", "Amelia Hart signed in"],
  ];
  for (const [action, entity, detail] of actions) {
    await pool.query(`insert into activity_logs (user_id, action, entity, detail) values ($1,$2,$3,$4)`, [pick(userIds), action, entity, detail]);
  }

  console.log("Seed complete.");
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
