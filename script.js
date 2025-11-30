const labels = Array.from({ length: 30 }, (_, i) => i + 1)
const data = [
    874, 2910, 1443, 1755, 2032, 1187, 2644, 2098, 1672, 2931,
    2541, 1893, 2765, 2399, 982, 1210, 2844, 2231, 1445, 1988,
    2722, 1367, 2499, 1795, 2611, 1456, 1910, 2850, 2112, 1690
  ];
  const dataConfig = {
    labels: labels,
    datasets: [{
      label: 'Daily Rollover Fees',
      data: data,
      fill: true,
      borderColor: 'rgb(120, 75, 192)',
      tension: 0.4
    }]
  };
  
const config = {
    type: 'line',
    data: dataConfig,
};

const chartCanvas = document.getElementById('myChart');
if (chartCanvas) {
  new Chart(chartCanvas, config);
}
  
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

function generateTransaction() {
    const amount = (Math.random() * 50 + 1).toFixed(2); // $1 - $50
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString();
  
    return {
      date: date,
      time: time,
      amount: amount
    };
  }
  
const txList = document.getElementById("transactionlist");
if (txList) {
    for (let i = 0; i < 5; i++) {
      addTransaction(generateTransaction());
    }
    

    setInterval(() => {
      const t = generateTransaction();
      addTransaction(t);
    }, 5000);
}

  

document.addEventListener("DOMContentLoaded", () => {
    const navConnect = document.getElementById("navConnect");

    const apiForm = document.getElementById("apiKeyForm");
    const connectScreen = document.getElementById("connectModal");
    const apiBtn = document.getElementById("apiConnectBtn");
    const initialSection = document.getElementById("initialApiSection");

    if (apiBtn && apiForm && initialSection) {
            apiBtn.addEventListener("click", () => {
                initialSection.remove();
                apiForm.classList.remove("d-none");
            });
    }

    if (apiForm && connectScreen && navConnect) {
        apiForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const publicKey = document.getElementById("publicApiKey").value.trim();
            const privateKey = document.getElementById("privateApiKey").value.trim();

            if (!publicKey || !privateKey) {
                alert("Please enter both API keys.");
                return;
            }

            const success = true;

            if (success) {
                alert("Connected successfully!");
                navConnect.textContent = "Bob";
                navConnect.style.pointerEvents = "none";
                const connectModal = bootstrap.Modal.getInstance(connectScreen);
                connectModal.hide();
            }
        });  
    }
});