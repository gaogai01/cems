// 全域變數 (用於儲存歷史數據與圖表實例)
//let historyData = null;
//let myChart = null;

/**
 * 開啟圖表視窗
 * 1. 顯示 Modal
 * 2. 預設選擇「液位」類別
 * 3. 產生勾選框
 * 4. 若無歷史資料則開始下載，若有則直接更新圖表
 */
function openChartModal() {
    document.getElementById('chartModal').style.display = 'block';
    
    // 預設選取類別
    const catSelect = document.getElementById('categorySelect');
    if (catSelect.value === "") catSelect.value = 'level';
    
    renderCheckboxes();
    
    // 如果還沒抓過歷史資料，就去抓；否則直接畫圖
    if (!historyData) {
        fetchHistory();
    } else {
        // 稍微延遲以確保 DOM 渲染完成
        setTimeout(() => {
            // 嘗試預設勾選一個項目 (例如檢知槽液位)，避免圖表空白
            const defaultChk = document.querySelector('input[value="LI018_VAL0"]'); // 預設 LI018
            if (defaultChk && document.querySelectorAll('#tagCheckboxes input:checked').length === 0) {
                defaultChk.checked = true;
            }
            updateChart();
        }, 100);
    }
}

/**
 * 關閉圖表視窗
 */
function closeChartModal() {
    document.getElementById('chartModal').style.display = 'none';
}

/**
 * 從後端 API 抓取歷史數據 (mode=history)
 */
function fetchHistory() {
    // 顯示載入中狀態 (可選)
    const ctx = document.getElementById('myChart').getContext('2d');
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = "20px Arial";
    ctx.fillStyle = "gray";
    ctx.textAlign = "center";
    ctx.fillText("數據載入中...", ctx.canvas.width/2, ctx.canvas.height/2);

    fetch(API_URL + "?mode=history")
        .then(res => res.json())
        .then(json => {
            historyData = json;
            updateChart();
        })
        .catch(err => {
            console.error("History fetch error:", err);
            alert("歷史數據載入失敗");
        });
}

/**
 * 根據選擇的類別 (Category) 渲染對應的勾選框
 */
function renderCheckboxes() {
    const cat = document.getElementById('categorySelect').value;
    const container = document.getElementById('tagCheckboxes');
    container.innerHTML = ''; // 清空舊選項

    let items = [];
    // 從 DASHBOARD_CONFIG 篩選出符合類別的項目
    DASHBOARD_CONFIG.forEach(group => {
        group.items.forEach(item => {
            if (item.cat === cat) {
                items.push(item);
            }
        });
    });

    // 生成 HTML
    items.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        div.innerHTML = `
            <input type="checkbox" value="${item.col}" id="chk_${item.col}" onchange="updateChart()">
            <label for="chk_${item.col}">${item.name} (${item.tag})</label>
        `;
        container.appendChild(div);
    });
    
    // 切換類別後，圖表會暫時清空，等待使用者勾選
    if(myChart) {
        myChart.data.datasets = [];
        myChart.update();
    }
}

/**
 * 核心繪圖函式
 * 根據時間範圍、選擇的點位，繪製 Chart.js 折線圖
 */
function updateChart() {
    if (!historyData) return;

    // 1. 取得篩選條件
    const timeRangeHours = parseInt(document.getElementById('timeRange').value);
    const selectedDateStr = document.getElementById('chartDate').value; // 如果有日期選擇器
    
    // 計算時間範圍 (預設以今天/現在為基準，或以選擇的日期 23:59:59 為基準)
    let endTime = new Date();
    if (selectedDateStr) {
        const d = new Date(selectedDateStr);
        endTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    }
    const startTime = endTime.getTime() - (timeRangeHours * 60 * 60 * 1000);

    const headers = historyData.headers;
    const rawRows = historyData.data; // 原始數據 (二維陣列)
    
    // 2. 找出被勾選的欄位
    const checkboxes = document.querySelectorAll('#tagCheckboxes input:checked');
    const selectedCols = [];
    checkboxes.forEach(chk => {
        const idx = headers.indexOf(chk.value);
        if (idx !== -1) {
            selectedCols.push({
                idx: idx,
                label: chk.parentNode.textContent.trim(), // 取得 label 文字
                key: chk.value,
                data: []
            });
        }
    });

    if (selectedCols.length === 0) {
        if(myChart) { myChart.data.datasets = []; myChart.update(); }
        return;
    }

    // 3. 遍歷數據，篩選時間並填入 Dataset
    const labels = [];
    
    // 為了效能，可以從後面開始往回找 (如果是按時間排序的話)
    // 這裡假設數據是依時間排序的，或者是亂序全掃描
    rawRows.forEach(row => {
        // row[0] 是 timestamp
        let timeStr = row[0];
        // 處理 iOS/Safari 日期相容性 (將 - 轉為 /)
        let rowDate = new Date(timeStr.replace(/-/g, "/"));
        let rowTime = rowDate.getTime();

        if (rowTime >= startTime && rowTime <= endTime.getTime()) {
            // 格式化 X 軸標籤 (月/日 時:分)
            let label = (rowDate.getMonth() + 1) + "/" + rowDate.getDate() + " " + 
                        rowDate.getHours().toString().padStart(2, '0') + ":" + 
                        rowDate.getMinutes().toString().padStart(2, '0');
            
            labels.push(label);
            
            // 填入各線條數據
            selectedCols.forEach(col => {
                let val = parseFloat(row[col.idx]);
                col.data.push(isNaN(val) ? null : val); // 無效值填 null 以斷開連線
            });
        }
    });

    // 4. 準備 Chart.js 的 Datasets
    const ctx = document.getElementById('myChart').getContext('2d');
    if (myChart) myChart.destroy();

    // 根據主題設定顏色
    const isDark = document.body.getAttribute("data-theme") === "dark";
    const gridColor = isDark ? '#444' : '#ddd';
    const textColor = isDark ? '#eee' : '#666';
    const colors = ['#007bff', '#28a745', '#dc3545', '#fd7e14', '#6f42c1', '#17a2b8', '#e83e8c', '#343a40'];

    let datasets = selectedCols.map((col, i) => ({
        label: col.label,
        data: col.data,
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length], // 點的顏色
        borderWidth: 2,
        pointRadius: 0, // 預設不顯示點，滑鼠移上去才顯示 hover
        pointHoverRadius: 5,
        fill: false,
        tension: 0.1 // 曲線平滑度
    }));

    // 5. 如果只選了一個點位，且該點位有設定警報值，則畫出警報線 (紅線/黃線)
    if (selectedCols.length === 1) {
        const key = selectedCols[0].key;
        const rule = ALARMS[key]; // 從 config.js 讀取
        
        if (rule) {
            // 判斷是高警報還是低警報
            let isLowAlarm = rule.warn > rule.crit;

            // 警告線 (黃色)
            if (rule.warn !== undefined) {
                datasets.push({
                    label: '警告 (' + rule.warn + ')',
                    data: new Array(labels.length).fill(rule.warn),
                    borderColor: '#ffc107',
                    borderDash: [5, 5], // 虛線
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                });
            }
            // 超限線 (紅色)
            if (rule.crit !== undefined) {
                datasets.push({
                    label: '超限 (' + rule.crit + ')',
                    data: new Array(labels.length).fill(rule.crit),
                    borderColor: '#dc3545',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                });
            }
        }
    }

    // 6. 繪製圖表
    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;
    
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 10, // 限制 X 軸標籤數量，避免擁擠
                        maxRotation: 0
                    },
                    grid: { color: gridColor }
                },
                y: {
                    grid: { color: gridColor },
                    beginAtZero: false // Y 軸不強制從 0 開始，更能看清變化
                }
            },
            plugins: {
                legend: {
                    labels: { color: textColor }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}
