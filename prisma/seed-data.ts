import { createHash } from "node:crypto";
import type { Prisma } from "../src/generated/prisma/client";

function seedId(userId: string, key: string) {
  const hex = createHash("sha256").update(`traceboard:banking-demo:v1:${userId}:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function bankingDemo(userId: string) {
  const id = (key: string) => seedId(userId, key);
  const requirements = [
    { title: "Secure sign-in", description: "Customers sign in with email and password.", priority: "CRITICAL", status: "TESTED" },
    { title: "Account balances", description: "Show current balances for all customer accounts.", priority: "HIGH", status: "TESTED" },
    { title: "Transfer between accounts", description: "Move funds between accounts owned by the customer.", priority: "CRITICAL", status: "APPROVED" },
    { title: "Transaction history", description: "List transactions with date and amount filters.", priority: "HIGH", status: "APPROVED" },
    { title: "Monthly statements", description: "Download monthly account statements.", priority: "MEDIUM", status: "APPROVED" },
    { title: "Card freeze", description: "Temporarily freeze a lost payment card.", priority: "HIGH", status: "TESTED" },
    { title: "Low-balance alerts", description: "Notify customers when a balance falls below their threshold.", priority: "MEDIUM", status: "DRAFT" },
    { title: "Beneficiary management", description: "Add and manage trusted transfer recipients.", priority: "LOW", status: "DRAFT" },
  ] as const;
  const stories = [
    ["Access my accounts", "customer", "sign in securely", "only I can access my accounts"],
    ["Review my balance", "customer", "see my account balances", "I can plan my spending"],
    ["Move money", "customer", "transfer money between my accounts", "I can fund my savings"],
    ["Review transactions", "customer", "filter my transaction history", "I can find a payment"],
    ["Change contact details", "customer", "update my phone number", "the bank can reach me"],
    ["Set a savings goal", "customer", "set a savings target", "I can track my progress"],
  ];
  const tests = [
    ["Valid sign-in", "Enter valid credentials and submit.", "The dashboard opens.", "PASSED"],
    ["Invalid password", "Submit an incorrect password.", "Access is denied with a clear error.", "PASSED"],
    ["Display balances", "Open accounts with known balances.", "Each balance matches the account ledger.", "PASSED"],
    ["Successful transfer", "Transfer a valid amount between owned accounts.", "Both balances update and a receipt appears.", "PASSED"],
    ["Insufficient funds", "Transfer more than the available balance.", "The transfer is rejected without changing balances.", "FAILED"],
    ["Filter transactions", "Select a date range in transaction history.", "Only transactions in that range appear.", "NOT_RUN"],
    ["Freeze a card", "Freeze an active card.", "The card is marked frozen and payments are blocked.", "PASSED"],
    ["Unfreeze a card", "Unfreeze a frozen card.", "The card becomes active again.", "NOT_RUN"],
    ["Update phone number", "Save a new valid phone number.", "The profile shows the new phone number.", "NOT_RUN"],
    ["Create savings goal", "Enter a target amount and save a goal.", "The goal appears with zero initial progress.", "NOT_RUN"],
  ] as const;
  type Kind = "REQUIREMENT" | "USER_STORY" | "TEST_CASE";
  const links: { source_type: Kind; source_id: string; target_type: Kind; target_id: string }[] = [];
  const link = (source: Kind, from: string, target: Kind, to: string) => links.push({ source_type: source, source_id: id(from), target_type: target, target_id: id(to) });
  for (let index = 1; index <= 4; index++) link("REQUIREMENT", `r${index}`, "USER_STORY", `s${index}`);
  for (const [requirement, test] of [[1, 1], [1, 2], [2, 3], [3, 4], [3, 5], [6, 7], [6, 8]]) link("REQUIREMENT", `r${requirement}`, "TEST_CASE", `t${test}`);
  // REQ-004 is covered only through US-004; REQ-005/007/008 deliberately have no tests.
  link("USER_STORY", "s4", "TEST_CASE", "t6");
  link("USER_STORY", "s5", "TEST_CASE", "t9");
  link("USER_STORY", "s6", "TEST_CASE", "t10");
  return {
    id: id("project"), owner_id: userId, name: "Online Banking App",
    description: "Demo banking project with direct and story-mediated coverage, uncovered requirements, orphan tests, and unassigned stories.",
    req_seq: 8, story_seq: 6, test_seq: 10,
    requirements: { create: requirements.map((requirement, index) => ({ ...requirement, id: id(`r${index + 1}`), code: `REQ-${String(index + 1).padStart(3, "0")}` })) },
    user_stories: { create: stories.map(([title, as_a, i_want, so_that], index) => ({ id: id(`s${index + 1}`), code: `US-${String(index + 1).padStart(3, "0")}`, title, as_a, i_want, so_that })) },
    test_cases: { create: tests.map(([title, steps, expected_result, status], index) => ({ id: id(`t${index + 1}`), code: `TC-${String(index + 1).padStart(3, "0")}`, title, steps, expected_result, status })) },
    links: { create: links },
  } satisfies Prisma.ProjectUncheckedCreateInput;
}
