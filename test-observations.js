// Finish Observations API endpoint tests
// Usage: node test-observations.js
//
// Replace USER_ID and TOKEN with valid credentials.

const BASE = "https://racematevercel.vercel.app/api";

const USER_ID = "6c990ce3-1ceb-44c5-9bdb-007c029081d2";
const TOKEN = "jphh84po1vq8mb0r8t4l";

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
  console.log("=== Finish Observations API Tests ===\n");

  const fakeRaceId = 999999;
  const fakeBoatId1 = 1001;
  const fakeBoatId2 = 1002;

  // 1. Add first observation
  const obs1Result = await test("addFinishObservation (boat 1001)", () =>
    post("addFinishObservation", {
      userId: USER_ID,
      token: TOKEN,
      raceId: fakeRaceId,
      boatId: fakeBoatId1,
      observedTime: Date.now() - 60000, // 1 minute ago
      observationInfo: { note: "clean finish" },
    })
  );

  const obs1Id = obs1Result?.observation?.[0]?.id;

  // 2. Add second observation
  const obs2Result = await test("addFinishObservation (boat 1002)", () =>
    post("addFinishObservation", {
      userId: USER_ID,
      token: TOKEN,
      raceId: fakeRaceId,
      boatId: fakeBoatId2,
      observedTime: Date.now() - 30000, // 30 seconds ago
      observationInfo: {},
    })
  );

  const obs2Id = obs2Result?.observation?.[0]?.id;

  // 3. Add a duplicate observation for boat 1001 (simulating second officer)
  const obs3Result = await test("addFinishObservation (boat 1001 again, 2s later)", () =>
    post("addFinishObservation", {
      userId: USER_ID,
      token: TOKEN,
      raceId: fakeRaceId,
      boatId: fakeBoatId1,
      observedTime: Date.now() - 58000, // 2 seconds after first
      observationInfo: { note: "second observer" },
    })
  );

  const obs3Id = obs3Result?.observation?.[0]?.id;

  // 4. Get all observations for this race
  await test("getFinishObservations", () =>
    post("getFinishObservations", {
      userId: USER_ID,
      token: TOKEN,
      raceId: fakeRaceId,
    })
  );

  // 5. Delete all observations
  const idsToDelete = [obs1Id, obs2Id, obs3Id].filter(Boolean);
  for (const id of idsToDelete) {
    await test(`deleteFinishObservation (id: ${id})`, () =>
      post("deleteFinishObservation", {
        userId: USER_ID,
        token: TOKEN,
        observationId: id,
      })
    );
  }

  // 6. Confirm they're gone
  const finalCheck = await test("getFinishObservations (should be empty)", () =>
    post("getFinishObservations", {
      userId: USER_ID,
      token: TOKEN,
      raceId: fakeRaceId,
    })
  );

  const remaining = finalCheck?.observations?.length ?? "?";
  console.log(`=== Tests complete — ${remaining} observations remaining (should be 0) ===`);
}

run();
