import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("."));

// delay helper between pages
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

//Fetch a single page of rollover ledgers from Kraken, borrowed code from Kraken Support Center

async function fetchLedgerPage({ publicKey, privateKey, ofs }) {
  const apiPath = "/0/private/Ledgers";
  const apiUrl = "https://api.kraken.com" + apiPath;

  const nonce = Date.now().toString();

  // only rollover entries
  const bodyString = `nonce=${nonce}&ofs=${ofs}&type=rollover&without_count=true`;

  // SHA256(nonce + bodyString)
  const sha256 = crypto
    .createHash("sha256")
    .update(nonce + bodyString)
    .digest();

  // HMAC-SHA512(path + sha256)
  const hmac = crypto
    .createHmac("sha512", Buffer.from(privateKey, "base64"))
    .update(Buffer.concat([Buffer.from(apiPath), sha256]))
    .digest("base64");

  const resp = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "API-Key": publicKey,
      "API-Sign": hmac,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: bodyString,
  });

  const json = await resp.json();

  if (!resp.ok || (json.error && json.error.length)) {
    if (json.error && json.error.includes("EAPI:Rate limit exceeded")) {
      const e = new Error("Rate limit");
      e.isRateLimit = true;
      throw e;
    }

    throw new Error("Kraken API error: " + json.error.join(", "));
  }

  return json.result || {};
}

app.post("/api/rollover-summary", async (req, res) => {
  try {
    const { publicKey, privateKey } = req.body || {};
    if (!publicKey || !privateKey) {
      return res.status(400).json({ ok: false, error: "Missing API keys" });
    }

    const allEntries = [];

    const pageSize = 50;    // what Kraken returns per page
    const maxPages = 100;   // cap pages for grading/demo

    let ofs = 0;

    for (let page = 0; page < maxPages; page++) {
      const result = await fetchLedgerPage({ publicKey, privateKey, ofs });
      const entries = Object.values(result.ledger || {});

      if (!entries.length) break;

      allEntries.push(...entries);
      ofs += entries.length;

      // if you get less than a full page, the import is done
      if (entries.length < pageSize) break;

      // delay between pages to avoid rate limits
      await sleep(4250);
    }

    // Only rollover entries in USD
    const ALLOWED_ASSETS = new Set(["USD", "ZUSD", "ZUSD.F"]);
    const rolloverEntries = allEntries.filter(
      (e) => e.type === "rollover" && ALLOWED_ASSETS.has(e.asset)
    );

    // newest → oldest
    rolloverEntries.sort((a, b) => b.time - a.time);

    // helper: figure out numeric rollover value for an entry. Taking in the 'amounts' and 'fees' objects in case one or the other is used
    function getRolloverValue(entry) {
      const hasAmount = entry.amount !== undefined && entry.amount !== null;
      const hasFee    = entry.fee    !== undefined && entry.fee    !== null;

      const amountNum = hasAmount ? Number(entry.amount) : 0;
      const feeNum    = hasFee    ? Number(entry.fee)    : 0;

      if (amountNum !== 0) return amountNum;
      if (feeNum    !== 0) return feeNum;
      return 0;
    }

    // recent list for UI
    const recent = rolloverEntries.slice(0, 30).map((e) => ({
      time:   e.time,              // unix seconds
      amount: getRolloverValue(e), // absolute number
      asset:  e.asset,
    }));

    // lifetime total
    const totalRolloverUsd = rolloverEntries.reduce(
      (sum, e) => sum + getRolloverValue(e),
      0
    );

    // time-window totals
    const nowSec = Date.now() / 1000;
    const oneDay = 24 * 60 * 60;
    const seven  = 7 * oneDay;
    const thirty = 30 * oneDay;
    const year   = 365 * oneDay;

    const totalsByWindow = {
      "1d": 0,
      "7d": 0,
      "30d": 0,
      "365d": 0,
    };

    for (const e of rolloverEntries) {
      const value = getRolloverValue(e);
      const age   = nowSec - e.time;

      if (age <= oneDay)  totalsByWindow["1d"]   += value;
      if (age <= seven)   totalsByWindow["7d"]   += value;
      if (age <= thirty)  totalsByWindow["30d"]  += value;
      if (age <= year)    totalsByWindow["365d"] += value;
    }

    return res.json({
      ok: true,
      summary: {
        count: rolloverEntries.length,
        totalRolloverUsd,
        totalsByWindow,
        recent,
      },
    });
  } catch (err) { //error catching, code borrowed from kraken support center
    if (err.isRateLimit) {
      return res.status(429).json({
        ok: false,
        error:
          "Kraken rate limit hit. Try again after a short pause and avoid repeated rapid requests.",
      });
    }

    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
