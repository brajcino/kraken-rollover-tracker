//CHART SETUP (placeholder data)
const labels = Array.from({ length: 30 }, (_, i) => i + 1);
const data = [
  874, 2910, 1443, 1755, 2032, 1187, 2644, 2098, 1672, 2931,
  2541, 1893, 2765, 2399, 982, 1210, 2844, 2231, 1445, 1988,
  2722, 1367, 2499, 1795, 2611, 1456, 1910, 2850, 2112, 1690,
];

const dataConfig = {
  labels,
  datasets: [{
    label: "Daily Rollover Fees",
    data,
    fill: true,
    borderColor: "rgb(120, 75, 192)",
    backgroundColor: "rgba(120, 75, 192, 0.1)",
    tension: 0.4,
    pointRadius: 3,
    pointHoverRadius: 5,
  }],
};

const chartConfig = {
  type: "line",
  data: dataConfig,
  options: {
    responsive: true,
    maintainAspectRatio: false,
  },
};

const chartCanvas = document.getElementById("myChart");
if (chartCanvas) {
  new Chart(chartCanvas, chartConfig);
}

// helper functions
function addTransaction(transaction) {
  const list = document.getElementById("transactionlist");
  if (!list) return;

  const li = document.createElement("li");
  li.className = "d-flex justify-content-between";
  li.innerHTML = `
    <span>${transaction.date} ${transaction.time}</span>
    <span>$${transaction.amount}</span>
  `;
  list.prepend(li);
}

function formatKrakenTime(unixSeconds) {
  const d = new Date(unixSeconds * 1000); //convert to unix
  return {
    date: d.toLocaleDateString(),
    time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

// AbortController for cancelling long loads
let currentController = null;

// MAIN FETCH LOGIC 
document.addEventListener("DOMContentLoaded", () => {
  const navConnect        = document.getElementById("navConnect");
  const apiForm           = document.getElementById("apiKeyForm");
  const connectScreen     = document.getElementById("connectModal");
  const apiBtn            = document.getElementById("apiConnectBtn");
  const initialSection    = document.getElementById("initialApiSection");

  const connectContent    = document.getElementById("connectContent");
  const loadingSection    = document.getElementById("loadingSection");
  const loadingPageNumber = document.getElementById("loadingPageNumber");
  const cancelLoadingBtn  = document.getElementById("cancelLoadingBtn");

  let loadingIntervalId   = null;
  let loadingPageCounter  = 1;

  // Show API form inside modal
  if (apiBtn && apiForm && initialSection) {
    apiBtn.addEventListener("click", () => {
      initialSection.remove();
      apiForm.classList.remove("d-none");
    });
  }

  // Cancel button
  if (cancelLoadingBtn) {
    cancelLoadingBtn.addEventListener("click", () => {
      if (currentController) {
        currentController.abort();
        currentController = null;
      }

      if (loadingIntervalId) {
        clearInterval(loadingIntervalId);
        loadingIntervalId = null;
      }

      if (loadingSection) loadingSection.classList.add("d-none");
      if (connectContent) connectContent.classList.remove("d-none");

      if (navConnect) {
        navConnect.textContent = "Connect";
        navConnect.style.pointerEvents = "";
      }

      const modalInstance = bootstrap.Modal.getInstance(connectScreen);
      modalInstance?.hide();
    });
  }

  // Submit API keys
  if (apiForm && connectScreen && navConnect) {
    apiForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const publicKey  = document.getElementById("publicApiKey").value.trim();
      const privateKey = document.getElementById("privateApiKey").value.trim();

      if (!publicKey || !privateKey) {
        alert("Please enter both API keys.");
        return;
      }

      try {
        // Switch to loading view
        if (connectContent) connectContent.classList.add("d-none");
        if (loadingSection) loadingSection.classList.remove("d-none");

        // fake page counter
        loadingPageCounter = 1;
        if (loadingPageNumber) loadingPageNumber.textContent = "1";

        if (loadingIntervalId) clearInterval(loadingIntervalId);
        loadingIntervalId = setInterval(() => {
          loadingPageCounter += 1;
          if (loadingPageNumber) {
            loadingPageNumber.textContent = String(loadingPageCounter);
          }
        }, 4250); // Roughly matches actual searching, but its fake

        // set up abort 
        currentController = new AbortController();
        const { signal } = currentController;

        const response = await fetch("/api/rollover-summary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ publicKey, privateKey }),
          signal,
        });

        const result = await response.json();

        // stop loading state
        if (loadingIntervalId) {
          clearInterval(loadingIntervalId);
          loadingIntervalId = null;
        }
        if (loadingSection) loadingSection.classList.add("d-none");

        if (!response.ok || !result.ok) {
          alert("Failed to connect: " + (result.error || "Unknown error"));

          if (connectContent) connectContent.classList.remove("d-none");
          navConnect.textContent = "Connect";
          navConnect.style.pointerEvents = "";
          return;
        }

        // Recent Rollover Fees list
        const recent = result.summary?.recent || [];
        const txList = document.getElementById("transactionlist");

        if (txList) {
          txList.innerHTML = "";

          recent.forEach((entry) => {
            const { date, time } = formatKrakenTime(entry.time);
            const displayAmount = Math.abs(entry.amount).toFixed(4);
            addTransaction({ date, time, amount: displayAmount });
          });
        }

        // Summary cards
        const summary = result.summary || {};
        const windows = summary.totalsByWindow || {};

        const cardMap = {
          "sum-1d":       windows["1d"],
          "sum-7d":       windows["7d"],
          "sum-30d":      windows["30d"],
          "sum-365d":     windows["365d"],
          "sum-lifetime": summary.totalRolloverUsd,
        };

        Object.entries(cardMap).forEach(([id, value]) => {
          const el = document.getElementById(id);
          if (!el) return;

          const num =
            typeof value === "number" && !Number.isNaN(value) ? value : 0;

          el.textContent = `$${num.toFixed(4)}`;
        });

        // success = lock nav button & close modal
        alert("Connected successfully!");
        navConnect.textContent = "Connected";
        navConnect.style.pointerEvents = "none";

        const connectModal = bootstrap.Modal.getInstance(connectScreen);
        connectModal.hide();
      } catch (err) {
        if (loadingIntervalId) {
          clearInterval(loadingIntervalId);
          loadingIntervalId = null;
        }
        if (loadingSection) loadingSection.classList.add("d-none");

        if (connectContent) connectContent.classList.remove("d-none");
        navConnect.textContent = "Connect";
        navConnect.style.pointerEvents = "";

        if (err.name !== "AbortError") {
          alert("Error connecting to backend.");
        }
      } finally {
        currentController = null;
      }
    });
  }
});
