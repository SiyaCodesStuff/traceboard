import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

function required(name) {
  assert(process.env[name], `Missing ${name} in .env.local`);
  return process.env[name];
}

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const client = () => createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const a = client();
const b = client();
const anonymous = client();
const projects = [];
const tracked = [];
let checks = 0;

async function success(request, label) {
  const result = await request;
  assert(!result.error, `${label}: ${result.error?.code ?? ""} ${result.error?.message ?? ""}`);
  return result.data;
}

async function denied(request, label) {
  const { error } = await request;
  assert.equal(error?.code, "42501", `${label}: expected an RLS/permission rejection`);
  checks++;
}

async function empty(request, label, allowPermissionError = false) {
  const { data, error } = await request;
  if (allowPermissionError && error?.code === "42501") {
    checks++;
    return;
  }
  assert(!error, `${label}: ${error?.message}`);
  assert.deepEqual(data, [], label);
  checks++;
}

async function signIn(c, suffix) {
  const data = await success(c.auth.signInWithPassword({
    email: required(`RLS_TEST_USER_${suffix}_EMAIL`),
    password: required(`RLS_TEST_USER_${suffix}_PASSWORD`),
  }), `Sign in user ${suffix}`);
  return data.user.id;
}

async function insert(c, table, values) {
  const row = { id: randomUUID(), updated_at: new Date().toISOString(), ...values };
  // Track before sending so cleanup can recover from a lost response.
  tracked.push({ c, table, id: row.id });
  const data = await success(c.from(table).insert(row).select("id").single(), `Insert ${table}`);
  assert.equal(data.id, row.id);
  checks++;
  return row;
}

async function verify(table, row, owner, other, otherProject, otherUser) {
  const rows = await success(owner.from(table).select("id").eq("id", row.id), `${table}: owner select`);
  assert.deepEqual(rows, [{ id: row.id }]);
  checks++;
  await empty(other.from(table).select("id").eq("id", row.id), `${table}: other select`);
  await empty(anonymous.from(table).select("id").eq("id", row.id), `${table}: anonymous select`, true);
  const patch = table === "Project" ? { name: "RLS updated" } : table === "Link"
    ? { updated_at: new Date().toISOString() } : { title: "RLS updated" };
  const updated = await success(owner.from(table).update(patch).eq("id", row.id).select("id"), `${table}: owner update`);
  assert.deepEqual(updated, [{ id: row.id }]);
  checks++;
  await empty(other.from(table).update(patch).eq("id", row.id).select("id"), `${table}: other update`);
  await empty(other.from(table).delete().eq("id", row.id).select("id"), `${table}: other delete`);
  const transfer = table === "Project" ? { owner_id: otherUser } : { project_id: otherProject };
  await denied(owner.from(table).update(transfer).eq("id", row.id), `${table}: ownership transfer`);
  const forbidden = { ...row, id: randomUUID() };
  if (table === "Link") forbidden.source_id = randomUUID();
  tracked.push({ c: owner, table, id: forbidden.id });
  await denied(other.from(table).insert(forbidden), `${table}: other insert`);
  await denied(anonymous.from(table).insert({ ...forbidden, id: randomUUID() }), `${table}: anonymous insert`);
  console.log(`PASS ${table}: owner access, cross-user restrictions, anonymous access, transfer prevention`);
}

try {
  const userA = await signIn(a, "A");
  const userB = await signIn(b, "B");
  assert.notEqual(userA, userB, "Use two distinct test users");
  const projectA = await insert(a, "Project", { name: "RLS temporary A", owner_id: userA });
  projects.push({ c: a, id: projectA.id });
  const projectB = await insert(b, "Project", { name: "RLS temporary B", owner_id: userB });
  projects.push({ c: b, id: projectB.id });

  for (const [owner, other, project, otherProject, otherUser] of [
    [a, b, projectA, projectB, userB], [b, a, projectB, projectA, userA],
  ]) {
    await verify("Project", project, owner, other, otherProject.id, otherUser);
    const definitions = [
      ["Requirement", { code: "REQ-1", title: "RLS test", priority: "MEDIUM", status: "DRAFT" }],
      ["UserStory", { code: "STORY-1", title: "RLS test", as_a: "tester", i_want: "isolation", so_that: "data stays private" }],
      ["TestCase", { code: "TEST-1", title: "RLS test", steps: "Check ownership", expected_result: "Access restricted", status: "NOT_RUN" }],
    ];
    const rows = {};
    for (const [table, values] of definitions) {
      const row = await insert(owner, table, { project_id: project.id, ...values });
      rows[table] = row;
      await verify(table, row, owner, other, otherProject.id, otherUser);
    }
    const link = await insert(owner, "Link", {
      project_id: project.id, source_type: "REQUIREMENT", source_id: rows.Requirement.id,
      target_type: "TEST_CASE", target_id: rows.TestCase.id,
    });
    await verify("Link", link, owner, other, otherProject.id, otherUser);
    for (const [table, row] of [...Object.entries(rows), ["Link", link]]) {
      const deleted = await success(owner.from(table).delete().eq("id", row.id).select("id"), `${table}: owner delete`);
      assert.deepEqual(deleted, [{ id: row.id }]);
      checks++;
    }
  }
  console.log(`PASS ${checks} RLS checks across both users`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  // Restrict cleanup to UUIDs generated by this run; never delete existing user data.
  for (const { c, table, id } of tracked.reverse()) {
    const { error } = await c.from(table).delete().eq("id", id);
    if (error) {
      console.error(`Cleanup failed for ${table} ${id}: ${error.code}`);
      process.exitCode = 1;
    }
  }
  for (const { c, id } of projects) {
    const rows = await success(c.from("Project").select("id").eq("id", id), "Verify cleanup");
    assert.deepEqual(rows, [], `Temporary project remains: ${id}`);
  }
  console.log("Temporary test rows cleaned up.");
}
