// Club API endpoint tests
// Usage: node test-clubs.js
//
// Before running, replace USER_ID and TOKEN with valid credentials.
// You can get these by signing in via the app and checking localStorage.

const BASE = "https://racematevercel.vercel.app/api";

const USER_ID = "6c990ce3-1ceb-44c5-9bdb-007c029081d2";
const TOKEN = "fp3qt54jd8wkhq9b0q6f";

async function post(endpoint, body) {
  const res = await fetch(`${BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function test(label, fn) {
  try {
    const result = await fn();
    console.log(`✓ ${label}`);
    console.log("  ", JSON.stringify(result, null, 2).split("\n").join("\n  "));
    console.log();
    return result;
  } catch (err) {
    console.log(`✗ ${label}`);
    console.log("  ERROR:", err.message);
    console.log();
    return null;
  }
}

async function run() {
  console.log("=== Club API Tests ===\n");

  // 1. Create a club
  const createResult = await test("createClub", () =>
    post("createClub", {
      userId: USER_ID,
      token: TOKEN,
      clubName: "Test Yacht Club",
      clubInfo: { description: "A test club" },
    })
  );

  const clubId = createResult?.club?.[0]?.id;
  if (!clubId) {
    console.log("!! createClub failed, cannot continue tests.");
    return;
  }

  // 2. Get all clubs
  await test("getAllClubs", () =>
    post("getAllClubs", {
      userId: USER_ID,
      token: TOKEN,
    })
  );

  // 3. Get my clubs (should include the new one)
  await test("getMyClubs", () =>
    post("getMyClubs", {
      userId: USER_ID,
      token: TOKEN,
    })
  );

  // 4. Get club members (should show us as admin)
  await test("getClubMembers", () =>
    post("getClubMembers", {
      userId: USER_ID,
      token: TOKEN,
      clubId: clubId,
    })
  );

  // 5. Try joining again (should say already a member)
  await test("joinClub (already member)", () =>
    post("joinClub", {
      userId: USER_ID,
      token: TOKEN,
      clubId: clubId,
    })
  );

  // 6. Try leaving as sole admin (should be prevented)
  await test("leaveClub (sole admin — should fail)", () =>
    post("leaveClub", {
      userId: USER_ID,
      token: TOKEN,
      clubId: clubId,
    })
  );

  // 7. Test with bad token
  await test("getAllClubs (bad token — should fail)", () =>
    post("getAllClubs", {
      userId: USER_ID,
      token: "invalid_token_12345",
    })
  );

  console.log("=== Tests complete ===");
  console.log(`\nNote: Test club "${createResult.club[0].name}" (id: ${clubId}) was created.`);
  console.log("You may want to delete it manually from the database.");
}

run();
