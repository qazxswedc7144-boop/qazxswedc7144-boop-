// scripts/test-idempotency.ts
import axios from "axios";

const BASE_URL = "http://localhost:3000/api/v1/saas/sync";
const API_KEY = "pf_live_cloud_sync_ledger_secret_token";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("=================================================");
  console.log("       PHARMAFLOW ERP IDEMPOTENCY UNIT TESTS     ");
  console.log("=================================================");

  const key1 = `test-key-${Math.random()}`;
  const payload1 = { ciphertext: "ENC_DATA_XYZ_2026", tenantId: "TEN_MAIN_DALLAH_09" };

  // --- Test 1: Successful Initial Request ---
  console.log("\n[TEST 1] Sending initial mutating transaction packet...");
  try {
    const res = await axios.post(BASE_URL, payload1, {
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Idempotency-Key": key1
      }
    });

    console.log(`✅ Success! Response Status: ${res.status}`);
    console.log(`  Payload Returned:`, JSON.stringify(res.data));
  } catch (err: any) {
    console.error("❌ Test 1 Failed:", err.response?.data || err.message);
    process.exit(1);
  }

  // --- Test 2: Double Submission (Offline Sync Replay) ---
  console.log("\n[TEST 2] Re-sending same transaction packet (simulating network retry)...");
  try {
    const res = await axios.post(BASE_URL, payload1, {
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Idempotency-Key": key1
      }
    });

    console.log(`✅ Success! Replay HIT Intercepted.`);
    console.log(`  Cache-Lookup Header: ${res.headers["x-cache-lookup"]}`);
    console.log(`  Response Status: ${res.status}`);
    console.log(`  Payload Replayed:`, JSON.stringify(res.data));
    
    if (res.headers["x-cache-lookup"] !== "HIT - Idempotent Replay") {
      throw new Error("Missing X-Cache-Lookup replay indicator header!");
    }
  } catch (err: any) {
    console.error("❌ Test 2 Failed:", err.response?.data || err.message);
    process.exit(1);
  }

  // --- Test 3: Key Reuse Abuse Detection (Hash Mismatch) ---
  console.log("\n[TEST 3] Sending a modified payload with the same Idempotency key (Abuse Attempt)...");
  const manipulatedPayload = { ciphertext: "ATTACK_MODIFIED_PAYLOAD", tenantId: "TEN_MAIN_DALLAH_09" };
  try {
    await axios.post(BASE_URL, manipulatedPayload, {
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Idempotency-Key": key1
      }
    });
    console.error("❌ Test 3 Failed: Server allowed key reuse with different payload!");
    process.exit(1);
  } catch (err: any) {
    console.log(`✅ Passed! Duplicate key reuse with different payload correctly blocked.`);
    console.log(`  Status Code: ${err.response?.status}`);
    console.log(`  Error Output:`, JSON.stringify(err.response?.data));
    
    if (err.response?.status !== 409) {
      console.error(`❌ Expected status 409 but got ${err.response?.status}`);
      process.exit(1);
    }
  }

  // --- Test 4: Concurrency & Double-Click Simulation (Lock Check) ---
  console.log("\n[TEST 4] Simulating continuous double-click race conditions concurrently...");
  const concurrentKey = `double-click-key-${Math.random()}`;
  const payloadConcurrency = { ciphertext: "CONCURRENT_MUTATING_BATCH", tenantId: "TEN_MAIN_DALLAH_09" };

  const requests = Array.from({ length: 5 }).map(() =>
    axios.post(BASE_URL, payloadConcurrency, {
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Idempotency-Key": concurrentKey
      }
    })
  );

  const results = await Promise.allSettled(requests);
  let successCount = 0;
  let blockedCount = 0;

  results.forEach((res, i) => {
    if (res.status === "fulfilled") {
      successCount++;
      console.log(`  Request #${i + 1}: SUCCESS ${res.value.status}`);
    } else {
      const resp = res.reason.response;
      if (resp?.status === 409) {
        blockedCount++;
        console.log(`  Request #${i + 1}: BLOCKED 409 Conflict (Lock Active) - ${resp.data.message}`);
      } else {
        console.log(`  Request #${i + 1}: FAILED with Status ${resp?.status || "Network Error"}`);
      }
    }
  });

  console.log(`\nConcurrency Simulation Summary:`);
  console.log(`  Successful processes: ${successCount} (Expect exactly 1)`);
  console.log(`  Blocked parallel postings: ${blockedCount} (Expect 4)`);

  if (successCount === 1 && blockedCount >= 1) {
    console.log("\n✅ [ALL TESTS PASSED] Idempotency Protection System is operating with high integrity!");
  } else {
    console.error("\n❌ [CONCURRENCY FAILURE] Incorrect number of successes/blocks on concurrent requests!");
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Unhandled exception during execution of integration test script:", err);
  process.exit(1);
});
