const records = [
  [1, "20260103", 2000, "微信", 1, 2000, ""],
  [2, "20260121", 3000, "微信", 1, 3000, ""],
  [3, "20260123", 2000, "微信", 1, 2000, ""],
  [4, "20260216", 5000, "微信", 1, 5000, ""],
  [5, "20260316", 8000, "微信", 1, 8000, ""],
  [6, "20260331", 6000, "微信", 1, 6000, ""],
  [7, "20260413", 3900, "微信", 1, 3900, ""],
  [8, "20260417", 5000, "微信", 1, 5000, ""],
  [9, "20260423", 9500, "微信", 1, 9500, ""],
  [10, "20260429", 8000, "微信", 1, 8000, ""],
  [11, "20260507", 9000, "微信", 1, 9000, ""],
  [12, "20260514", 19200, "未注明", 1, 19200, "手写备注疑似“货—黄土光”，请核对"],
  [13, "20260521", 1840, "微信", 1, 1840, ""],
  [14, "20260522", 2500, "微信", 1, 2500, ""],
  [15, "20260602", 16000, "微信", 1, 16000, ""],
  [16, "20260603", 840, "微信", 1, 840, ""],
  [17, "20260605", 25000, "微信", 1, 25000, ""],
  [18, "20260618", 7000, "公账", 1, 7000, "未标注折算系数"],
  [19, "20260701", 20000, "微信", 1, 20000, ""],
  [20, "20260703", 3600, "微信", 1, 3600, ""],
  [21, "20260722", 2000, "微信", 1, 2000, ""],
  [22, "20260729", 47500, "公账", 0.915, 43462.5, "按 0.915 折算"],
  [23, "20260819", 7000, "微信", 1, 7000, ""],
  [24, "20260822", 300, "微信", 1, 300, ""],
  [25, "20260826", 14950, "公账", 0.915, 13679.25, "按 0.915 折算"],
  [26, "20260830", 17950, "公账", 0.915, 16424.25, "按 0.915 折算"],
  [27, "20260903", 1300, "未注明", 1, 1300, "未注明付款方式"],
  [28, "20260924", 36980, "公账", 0.915, 33836.7, "按 0.915 折算"],
].map(([id, date, raw, method, factor, adjusted, note]) => ({ id, date, raw, method, factor, adjusted, note }));

const money = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", minimumFractionDigits: 2 });
const rowsEl = document.querySelector("#ledgerRows");
const searchInput = document.querySelector("#searchInput");
const sortButton = document.querySelector("#sortButton");
const emptyState = document.querySelector("#emptyState");
const resultText = document.querySelector("#resultText");
const filteredTotal = document.querySelector("#filteredTotal");
const filterTabs = [...document.querySelectorAll(".filter-tab")];

let activeFilter = "全部";
let ascending = true;

function mobileLabel(text) {
  return `<span class="mobile-label">${text}</span>`;
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = records
    .filter((record) => activeFilter === "全部" || record.method === activeFilter)
    .filter((record) => `${record.date} ${record.method} ${record.note}`.toLowerCase().includes(query))
    .sort((a, b) => ascending ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));

  rowsEl.innerHTML = visible.map((record, index) => `
    <div class="ledger-row" role="row" style="animation-delay:${Math.min(index * 14, 160)}ms">
      <span class="date-value" role="cell">${record.date}</span>
      <span class="method-badge" data-method="${record.method}" role="cell">${record.method}</span>
      <span class="amount raw-block" role="cell">${mobileLabel("原始金额")}${money.format(record.raw)}</span>
      <span class="factor-cell" role="cell">${mobileLabel("折算系数")}${record.factor < 1 ? `<span class="factor-badge">× ${record.factor.toFixed(3)}</span>` : `<span class="factor-plain">1.000</span>`}</span>
      <span class="amount amount--adjusted adjusted-block" role="cell">${mobileLabel("计入金额")}${money.format(record.adjusted)}</span>
      <span class="note" role="cell">${record.note || "—"}</span>
    </div>
  `).join("");

  const sum = visible.reduce((total, record) => total + record.adjusted, 0);
  resultText.textContent = `显示 ${visible.length} 笔记录`;
  filteredTotal.textContent = `折算合计 ${money.format(sum)}`;
  emptyState.hidden = visible.length !== 0;
}

filterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeFilter = tab.dataset.filter;
    filterTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    render();
  });
});

searchInput.addEventListener("input", render);
sortButton.addEventListener("click", () => {
  ascending = !ascending;
  sortButton.innerHTML = `日期${ascending ? "正序" : "倒序"} <span aria-hidden="true">${ascending ? "↑" : "↓"}</span>`;
  render();
});

render();
