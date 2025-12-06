//這裡放 openChartModal, updateChart 等功能。
//(負責歷史趨勢圖)
function openChartModal() {
    document.getElementById('chartModal').style.display = 'block';
    renderCheckboxes();
    document.getElementById('categorySelect').value = 'level';
    renderCheckboxes();
    
    // 預設選中一個
    setTimeout(() => {
        // ... 原本的邏輯 ...
        if (!historyData) fetchHistory(); else updateChart();
    }, 100);
}

function closeChartModal() { document.getElementById('chartModal').style.display = 'none'; }

function fetchHistory() {
    fetch(API_URL + "?mode=history").then(res => res.json()).then(json => {
        historyData = json;
        updateChart();
    });
}

function renderCheckboxes() {
    // ... 原本的 checkbox 生成邏輯 ...
}

function updateChart() {
    // ... 原本的 Chart.js 繪圖邏輯 ...
}

// 點擊視窗外部關閉
window.onclick = function(event) {
    if (event.target == document.getElementById('chartModal')) closeChartModal();
    if (event.target == document.getElementById('waterReportModal')) closeWaterReport(); // 報表視窗也一起處理
}
