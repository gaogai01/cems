//index.html曲線圖

// ============================================================
// 1. 設定區
// ============================================================
const CHART_API_URL = "https://script.google.com/macros/s/AKfycbz7e5iwN7g122fMywsZUVF3YyOUtQWsmYzz_rO-NuKW55zpUsNUOMgKnY5bBV-6k9KM/exec";

// 初始化全域變數
if (typeof window.myChart === 'undefined') {
    window.myChart = null;
}

// ============================================================
// 2. 核心輔助函式
// ============================================================

function getHistoryData() {
    if (window.historyData && window.historyData.data && window.historyData.data.length > 0) {
        return window.historyData;
    }
    if (typeof historyData !== 'undefined' && historyData && historyData.data && historyData.data.length > 0) {
        window.historyData = historyData;
        return historyData;
    }
    return null;
}

function setHistoryData(json) {
    window.historyData = json;
    try {
        if (typeof historyData !== 'undefined') {
            historyData = json;
        }
    } catch (e) {
        console.warn("變數同步警告", e);
    }
}

// 日期切換函式
function changeDate(offset) {
    const dateInput = document.getElementById('chartEndDate');
    if (!dateInput) return;

    let currentDate = dateInput.value ? new Date(dateInput.value) : new Date();
    currentDate.setDate(currentDate.getDate() + offset);
    
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    
    dateInput.value = `${year}-${month}-${day}`;
    updateChart();
}

/**
 * 頁面登入並完成儀表板初始化後，自動載入今日液位曲線。
 * 只初始化一次；保留使用者已設定的日期與分類。
 */
function initializeChart() {
    if (window.chartInitialized) return;

    const dateInput = document.getElementById('chartEndDate');
    const categorySelect = document.getElementById('categorySelect');
    const checkboxContainer = document.getElementById('tagCheckboxes');
    if (!dateInput || !categorySelect || !checkboxContainer) return;

    window.chartInitialized = true;

    if (!dateInput.value) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }

    if (!categorySelect.value) categorySelect.value = 'level';
    renderCheckboxes();

    if (getHistoryData()) {
        autoSelectDefault();
        updateChart();
    } else {
        fetchHistory();
    }
}

// ============================================================
// 3. 視窗控制
// ============================================================

function openChartModal() {
    const modal = document.getElementById('chartModal');
    if(modal) modal.style.display = 'block';
    
    const dateInput = document.getElementById('chartEndDate');
    if (dateInput) {
        if (!dateInput.value) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            dateInput.value = `${year}-${month}-${day}`;
        }
    }

    const catSelect = document.getElementById('categorySelect');
    if (catSelect && catSelect.value === "") catSelect.value = 'level';
    
    renderCheckboxes();
    
    const currentData = getHistoryData();
    if (!currentData) {
        console.log("無快取資料，下載中...");
        fetchHistory();
    } else {
        console.log("使用快取資料");
        setTimeout(() => {
            autoSelectDefault();
            updateChart();
        }, 100);
    }
}

function closeChartModal() {
    const modal = document.getElementById('chartModal');
    if(modal) modal.style.display = 'none';
}

function autoSelectDefault() {
    const defaultTag = "LIT000_VAL0"; 
    const defaultChk = document.querySelector(`input[value="${defaultTag}"]`); 
    const checked = document.querySelectorAll('#tagCheckboxes input:checked');
    
    if (defaultChk && checked.length === 0) {
        defaultChk.checked = true;
        defaultChk.dispatchEvent(new Event('change'));
    }
}

// ============================================================
// 4. 資料抓取
// ============================================================

function fetchHistory() {
    const loading = document.getElementById('chartLoading');
    if(loading) loading.style.display = 'block';

    console.log("開始抓取歷史資料...");

    fetch(CHART_API_URL + "?mode=history")
        .then(response => {
            if (!response.ok) throw new Error("網路回應");
            return response.json();
        })
        .then(json => {
            console.log("資料抓取成功，筆數:", json.data ? json.data.length : 0);
            setHistoryData(json);
            
            if(loading) loading.style.display = 'none';
            
            setTimeout(() => {
                renderCheckboxes(); 
                autoSelectDefault();
                updateChart();
                if (document.getElementById("cardDetailModal")?.style.display === "block") {
                    renderCardDetailChart();
                }
            }, 100);
        })
        .catch(error => {
            console.error('Fetch Error:', error);
            if (loading) {
                loading.innerHTML = `<div style="color:red; padding:20px;">
                    載入失敗<br><small>${error.message}</small><br>
                    <button onclick="fetchHistory()" style="margin-top:10px;">重試</button>
                </div>`;
            }
            const detailModal = document.getElementById("cardDetailModal");
            const detailStatus = document.getElementById("cardDetailStatus");
            if (detailModal?.style.display === "block" && detailStatus) {
                detailStatus.textContent = "歷史資料載入失敗，請稍後再試；目前值與歷史曲線分開顯示。";
            }
        });
}

// ============================================================
// 5. 選單與 Checkbox 渲染
// ============================================================

const CATEGORIES = {
    'level': ['LIT000_VAL0','LI003_VAL0','LI012_VAL0','LI021_VAL0','LI022_VAL0','LI018_VAL0', 'LI011_VAL0'], 
    'flow':  ['FI000B_Q_VAL0','FI000A_Q_VAL0','FI003_Q_VAL0','FI012_Q_VAL0','FI021W_Q_VAL0','FI018_Q_VAL0','FI018B_Q_VAL0'], 
    'ph':    ['PHI015_VAL0','PHI013_VAL0','PHI014_VAL0','PHI017_VAL0','PHI018_VAL0'], 
    'quality': ['SS018_VAL0','COD018_VAL0','OFD018_VAL0', 'NH3N018_VAL0'], 
    'pac': ['LI044_VAL0','LI048_VAL0','LI049_VAL0','LI043_VAL0']
};

const TAG_NAMES = {
    'LIT000_VAL0': 'T05-01二段式API槽水位', 'LI003_VAL0': 'T05-04中間水槽水位', 'LI012_VAL0': 'T01-01調勻槽水位', 'LI021_VAL0': 'T02-01生活污水槽水位','LI022_VAL0': 'T02-02 SBR水位', 'LI018_VAL0': 'T01-07進水檢知槽水位',
    'FI000B_Q_VAL0': 'API進口累積流量','FI000A_Q_VAL0': 'API出口累積流量', 'FI003_Q_VAL0': 'DAF進口累積流量', 'FI012_Q_VAL0': '調勻槽出口累積流量', 'FI021W_Q_VAL0': '生活污水累積流量', 'FI018_Q_VAL0': '放流水累積流量', 'FI018B_Q_VAL0': '回收水累積流量',
    'PHI015_VAL0': '靜態攪拌管pH', 'PHI013_VAL0': '第一酸鹼槽PH', 'PHI014_VAL0': '膠凝槽PH', 'PHI017_VAL0': '第二酸鹼槽PH', 'PHI018_VAL0': '放流水PH',
    'SS018_VAL0': '放流水SS', 'COD018_VAL0': '放流水COD', 'OFD018_VAL0': '放流水油脂',
    'LI044_VAL0': '鹼槽液位', 'LI048_VAL0': '凝膠儲槽液位', 'LI049_VAL0': 'PAC儲槽液位', 'LI043_VAL0': '酸槽液位',
    'LI011_VAL0': 'T02-04回收水槽液位',
    'NH3N018_VAL0': '放流水氨氮'
};

function renderCheckboxes() {
    const catSelect = document.getElementById('categorySelect');
    const container = document.getElementById('tagCheckboxes');
    if(!container || !catSelect) return;
    
    const cat = catSelect.value;
    container.innerHTML = ""; 

    const tags = CATEGORIES[cat] || [];
    
    tags.forEach(tag => {
        const label = document.createElement('label');
        label.className = "checkbox-item";
        label.style.cssText = "display:inline-flex; align-items:center; padding:4px 12px; cursor:pointer; background:#fff; border:1px solid #ced4da; border-radius:20px; font-size:0.9rem; transition:all 0.2s; user-select:none; margin-right:8px;";

        const input = document.createElement('input');
        input.type = "checkbox";
        input.value = tag;
        input.style.display = "none"; 

        const checkMark = document.createElement('span');
        checkMark.innerText = "✔ ";
        checkMark.style.display = "none";
        checkMark.style.marginRight = "5px";

        input.onchange = function() {
            if(this.checked) {
                label.style.backgroundColor = "#e8eaf6";
                label.style.borderColor = "#3f51b5";
                label.style.color = "#3f51b5";
                label.style.fontWeight = "bold";
                checkMark.style.display = "inline";
            } else {
                label.style.backgroundColor = "#fff";
                label.style.borderColor = "#ced4da";
                label.style.color = "#000";
                label.style.fontWeight = "normal";
                checkMark.style.display = "none";
            }
            updateChart();
        }; 

        label.onmouseover = function() { 
            if(!input.checked) { this.style.borderColor = "#3f51b5"; this.style.color = "#3f51b5"; }
        };
        label.onmouseout = function() { 
            if(!input.checked) { this.style.borderColor = "#ced4da"; this.style.color = "#000"; }
        };

        label.appendChild(input);
        label.appendChild(checkMark);
        label.appendChild(document.createTextNode(TAG_NAMES[tag] || tag));
        
        container.appendChild(label);
    });
}

// ============================================================
// 6. 圖表核心繪製邏輯
// ============================================================

function updateChart() {
    const dataObj = getHistoryData();
    if (!dataObj || !dataObj.data) {
        if (!window.fetchTimeout) {
            window.fetchTimeout = setTimeout(() => {
                fetchHistory();
                window.fetchTimeout = null;
            }, 2000);
        }
        return;
    }

    const checkedBoxes = document.querySelectorAll('#tagCheckboxes input:checked');
    const selectedTags = Array.from(checkedBoxes).map(cb => cb.value);
    
    const statsContainer = document.getElementById('chartStats');
    const ctxCanvas = document.getElementById('historyChart');
    if(!ctxCanvas) return;
    const ctx = ctxCanvas.getContext('2d');
    
    if (selectedTags.length === 0) {
        if (window.myChart) {
            window.myChart.data.datasets = [];
            window.myChart.update();
        }
        if(statsContainer) statsContainer.innerHTML = '<span style="color:#999; font-style:italic; padding:5px;">請勾選項目...</span>';
        return;
    }

    const isSingleSelection = selectedTags.length === 1;
    const appAlarms = window.ALARMS || (typeof ALARMS !== 'undefined' ? ALARMS : {});
    const headers = dataObj.headers;
    const rows = dataObj.data;

    const tagIndices = selectedTags.map(tag => {
        return { tag: tag, index: headers.indexOf(tag) };
    });

    const datasets = [];
    const colors = ['#3f51b5', '#e91e63', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#795548'];
    const annotations = {}; 
    let statsHTML = ""; 
    
    let maxDataVal = 0;   
    let maxAlarmVal = 0;  

    const rangeSelect = document.getElementById('timeRangeSelect');
    const dateInput = document.getElementById('chartEndDate');
    const range = rangeSelect ? rangeSelect.value : '24h';
    
    // --- 📊 設定 X 軸時間邏輯 (Time Scale Config) ---
    let timeUnit = 'hour';
    let stepSize = 1;
    let displayFormats = {};
    let tooltipFormat = 'MM/dd HH:mm';
    let maxTicks = 12; // 預設 Tick 限制

    if (range === '24h') {
        timeUnit = 'hour';
        stepSize = 2; // 每2小時
        displayFormats = { hour: 'HH:mm' }; 
        maxTicks = 13;
    } else if (range === '7d') {
        timeUnit = 'hour';
        stepSize = 12; // 每12小時 (00:00, 12:00)
        displayFormats = { hour: 'MM/dd HH:mm' }; 
        maxTicks = 20; // 7天*2 = 14個點，稍微放寬限制以確保顯示
    } else if (range === '30d') {
        timeUnit = 'day';
        stepSize = 2; // 每2天
        displayFormats = { day: "d'號' HH:mm" }; 
        maxTicks = 16;
    }

    let endTime = new Date();
    if (dateInput && dateInput.value) {
        endTime = new Date(dateInput.value);
        endTime.setHours(23, 59, 59, 999);
    } 

    let startTime = new Date(endTime);
    if (range === '24h') startTime.setHours(endTime.getHours() - 24);
    else if (range === '7d') startTime.setDate(endTime.getDate() - 7);
    else if (range === '30d') startTime.setDate(endTime.getDate() - 30);
    
    let dataSlice = rows.filter(r => {
        if(!r[0]) return false;
        const d = new Date(r[0]);
        if(isNaN(d.getTime())) return false;
        return d >= startTime && d <= endTime;
    });

    const labels = dataSlice.map(r => new Date(r[0]));

    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? '#444' : '#eee'; 
    const textColor = isDark ? '#eee' : '#666';

    tagIndices.forEach((item, i) => {
        if (item.index > -1) {
            const rawData = dataSlice.map(r => parseFloat(r[item.index]));
            const validData = rawData.filter(v => !isNaN(v) && v !== null);

            let maxVal = "-", minVal = "-", avgVal = "-";
            if (validData.length > 0) {
                const currentMax = Math.max(...validData);
                maxDataVal = Math.max(maxDataVal, currentMax); 
                
                maxVal = currentMax.toFixed(1);
                minVal = Math.min(...validData).toFixed(1);
                const sum = validData.reduce((a, b) => a + b, 0);
                avgVal = (sum / validData.length).toFixed(1);
            }

            const tagName = TAG_NAMES[item.tag] || item.tag;
            const colorCode = colors[i % colors.length];
            
            statsHTML += `
                <div style="display:inline-flex; align-items:center; background:${isDark ? '#555' : '#fff'}; border:1px solid ${colorCode}; padding:2px 10px; border-radius:15px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                    <span style="width:8px; height:8px; background:${colorCode}; border-radius:50%; margin-right:6px;"></span>
                    <strong style="margin-right:8px; color:${isDark ? '#fff' : '#333'};">${tagName}</strong>
                    <span style="font-size:0.9em; color:${isDark ? '#ccc' : '#666'};">
                        均:<b style="color:${isDark ? '#fff' : '#000'}">${avgVal}</b> 
                        <span style="margin:0 4px; color:#ddd">|</span> 
                        高:<span style="color:#d32f2f">${maxVal}</span> 
                        <span style="margin:0 4px; color:#ddd">|</span>
                        低:<span style="color:#1976d2">${minVal}</span>
                    </span>
                </div>
            `;

            const dataPoints = rawData.map(v => isNaN(v) ? null : v);
            
            datasets.push({
                label: tagName,
                data: dataPoints,
                borderColor: colorCode,
                backgroundColor: colorCode,
                borderWidth: 2,
                // ▼▼▼ 修改：隱藏數據點 ▼▼▼
                pointRadius: 0, 
                pointHoverRadius: 5, // 滑鼠懸停時顯示，方便看數值
                // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
                fill: false,
                tension: 0.3 
            });

            if (isSingleSelection && appAlarms && appAlarms[item.tag]) {
                const alarm = appAlarms[item.tag];
                
                if (alarm.crit) maxAlarmVal = Math.max(maxAlarmVal, alarm.crit);
                if (alarm.warn) maxAlarmVal = Math.max(maxAlarmVal, alarm.warn);

                if (alarm.warn !== undefined) {
                    annotations['warnLine_' + item.tag] = {
                        type: 'line',
                        yMin: alarm.warn,
                        yMax: alarm.warn,
                        borderColor: '#FFC107',
                        borderWidth: 2,
                        borderDash: [6, 6],
                        label: {
                            display: true,
                            content: '警戒 ' + alarm.warn,
                            position: 'start', 
                            backgroundColor: 'rgba(255, 193, 7, 0.8)',
                            font: { size: 10 }
                        }
                    };
                }

                if (alarm.crit !== undefined) {
                    annotations['critLine_' + item.tag] = {
                        type: 'line',
                        yMin: alarm.crit,
                        yMax: alarm.crit,
                        borderColor: '#F44336',
                        borderWidth: 2,
                        borderDash: [6, 6],
                        label: {
                            display: true,
                            content: '危險 ' + alarm.crit,
                            position: 'start',
                            backgroundColor: 'rgba(244, 67, 54, 0.8)',
                            font: { size: 10 }
                        }
                    };
                }
            }
        }
    });
    
    if(statsContainer) statsContainer.innerHTML = statsHTML;

    if (window.myChart) window.myChart.destroy();
    
    let yAxisSuggestedMax = undefined;
    if (isSingleSelection) {
        const targetMax = Math.max(maxDataVal, maxAlarmVal);
        if (targetMax > 0) {
            // ▼▼▼ 修改：Y軸最大值無緩衝，直接切齊 ▼▼▼
            yAxisSuggestedMax = targetMax * 1.0;
            // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
        }
    }

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    type: 'time', 
                    time: {
                        unit: timeUnit,
                        stepSize: stepSize,
                        displayFormats: displayFormats,
                        tooltipFormat: tooltipFormat
                    },
                    ticks: { 
                        color: textColor,
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: maxTicks // 根據 7d 需求放寬限制
                    },
                    grid: { color: gridColor, drawBorder: false }
                },
                y: {
                    suggestedMax: yAxisSuggestedMax,
                    grid: { color: gridColor, borderDash: [2, 2] }, 
                    ticks: { color: textColor },
                    beginAtZero: false 
                }
            },
            plugins: {
                legend: { labels: { color: textColor }, display: !isSingleSelection },
                annotation: { annotations: annotations },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const date = new Date(context[0].parsed.x);
                            const m = String(date.getMonth()+1).padStart(2,'0');
                            const d = String(date.getDate()).padStart(2,'0');
                            const h = String(date.getHours()).padStart(2,'0');
                            const min = String(date.getMinutes()).padStart(2,'0');
                            return `${m}/${d} ${h}:${min}`;
                        }
                    }
                }
            }
        }
    });
}

// 綁定事件
window.addEventListener('click', function(event) {
    const modal = document.getElementById('chartModal');
    if (event.target == modal) {
        closeChartModal();
    }
});

window.addEventListener('resize', function() {
    if (window.myChart) {
        updateChart();
    }
});


// 卡片點擊後的單項歷史曲線明細。來源沿用廢水歷史 API，不以目前值補造歷史資料。
let cardDetailChartInstance = null;
window.activeCardDetail = null;

function openCardDetail(card) {
    if (!card) return;
    window.activeCardDetail = {
        col: card.dataset.settingsCol || "",
        name: card.dataset.settingsName || "監測項目",
        tag: card.dataset.settingsTag || "",
        unit: card.dataset.settingsUnit || ""
    };
    const modal = document.getElementById("cardDetailModal");
    const range = document.getElementById("cardDetailRange");
    if (!modal) return;
    if (range) range.value = "24h";
    modal.style.display = "block";
    refreshCardDetailSummary();
    const status = document.getElementById("cardDetailStatus");
    if (status) status.textContent = "正在載入歷史資料…";
    if (!getHistoryData()) {
        fetchHistory();
    } else {
        renderCardDetailChart();
    }
}

function closeCardDetail() {
    const modal = document.getElementById("cardDetailModal");
    if (modal) modal.style.display = "none";
    if (cardDetailChartInstance) {
        cardDetailChartInstance.destroy();
        cardDetailChartInstance = null;
    }
}

function refreshCardDetailSummary() {
    const active = window.activeCardDetail;
    if (!active) return;
    const summary = document.getElementById("cardDetailSummary");
    const title = document.getElementById("cardDetailTitle");
    const raw = window.currentDashboardData && window.currentDashboardData[active.col];
    const value = raw === null || raw === undefined || String(raw).trim() === "" ? null : Number(raw);
    const displayValue = value !== null && Number.isFinite(value) ? value.toLocaleString("zh-TW", { maximumFractionDigits: 2 }) : "—";
    if (title) title.textContent = active.name + (active.tag ? "｜" + active.tag : "") + " 歷史曲線";
    if (summary) {
        const updateTime = document.getElementById("last-update");
        summary.textContent = "目前值：" + displayValue + (active.unit ? " " + active.unit : "") +
            (updateTime && updateTime.textContent ? "　資料更新：" + updateTime.textContent : "");
    }
}

function editCardDetailSettings() {
    const active = window.activeCardDetail;
    if (!active) return;
    const card = Array.from(document.querySelectorAll(".card-configurable"))
        .find(item => item.dataset.settingsCol === active.col);
    if (card) openCardSettings(card);
}

function renderCardDetailChart() {
    const active = window.activeCardDetail;
    const canvas = document.getElementById("cardDetailChart");
    const status = document.getElementById("cardDetailStatus");
    if (!active || !canvas || !status) return;
    if (cardDetailChartInstance) {
        cardDetailChartInstance.destroy();
        cardDetailChartInstance = null;
    }
    const dataObj = getHistoryData();
    if (!dataObj || !Array.isArray(dataObj.data) || dataObj.data.length === 0) {
        status.textContent = "歷史資料尚未載入；請稍後再開啟曲線。";
        return;
    }

    const headers = Array.isArray(dataObj.headers) ? dataObj.headers : [];
    const candidates = [active.col, active.col.replace(/_VAL0$/, "_Q_VAL0"), active.tag]
        .filter(Boolean);
    const columnIndex = candidates.map(key => headers.indexOf(key)).find(index => index >= 0);
    if (columnIndex === undefined) {
        status.textContent = "此測項尚未寫入廢水歷史資料，暫無曲線可顯示。";
        return;
    }

    const rangeValue = document.getElementById("cardDetailRange")?.value || "24h";
    const endTime = new Date();
    const startTime = new Date(endTime);
    if (rangeValue === "7d") startTime.setDate(startTime.getDate() - 7);
    else if (rangeValue === "30d") startTime.setDate(startTime.getDate() - 30);
    else startTime.setHours(startTime.getHours() - 24);

    const points = [];
    dataObj.data.forEach(row => {
        if (!Array.isArray(row) || !row[0]) return;
        const time = new Date(row[0]);
        if (!Number.isFinite(time.getTime()) || time < startTime || time > endTime) return;
        const raw = row[columnIndex];
        if (raw === null || raw === undefined || String(raw).trim() === "") return;
        const number = Number(raw);
        if (Number.isFinite(number)) points.push({ x: time, y: number });
    });
    points.sort((a, b) => a.x - b.x);
    if (points.length === 0) {
        status.textContent = "所選時間範圍內沒有歷史資料；不會以零值代替缺值。";
        return;
    }

    const isDark = document.body.getAttribute("data-theme") === "dark";
    const textColor = isDark ? "#e0e0e0" : "#475569";
    const gridColor = isDark ? "#444" : "#e2e8f0";
    const color = "#2563eb";
    const datasets = [{
        label: active.name,
        data: points,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.2,
        spanGaps: false,
        fill: false
    }];

    let rule = typeof getAlarmRule === "function" ? getAlarmRule(active.col) : (ALARMS && ALARMS[active.col]);
    const isPh = active.col.indexOf("PHI") === 0;
    if (isPh && !hasCustomAlarmRule(active.col)) {
        rule = { min: 0, max: 14, warnLow: 6.5, critLow: 6, warnHigh: 8.5, critHigh: 9 };
    }
    const addThreshold = (label, value, lineColor, dash) => {
        if (value === null || value === undefined || !Number.isFinite(Number(value))) return;
        datasets.push({
            label: label + " " + value,
            data: [{ x: startTime, y: Number(value) }, { x: endTime, y: Number(value) }],
            borderColor: lineColor,
            backgroundColor: lineColor,
            borderDash: dash,
            borderWidth: 1.8,
            pointRadius: 0,
            pointHoverRadius: 0,
            pointHitRadius: 0,
            tension: 0,
            fill: false
        });
    };

    if (rule) {
        if (rule.warnLow !== undefined) {
            addThreshold("低警報", rule.warnLow, "#f59e0b", [7, 5]);
            addThreshold("低超限", rule.critLow, "#ef4444", [3, 4]);
            addThreshold("高警報", rule.warnHigh, "#f59e0b", [7, 5]);
            addThreshold("高超限", rule.critHigh, "#ef4444", [3, 4]);
        } else {
            addThreshold("警報值", rule.warn, "#f59e0b", [7, 5]);
            addThreshold("超限值", rule.crit, "#ef4444", [3, 4]);
        }
    }

    status.textContent = "近 " + (rangeValue === "24h" ? "24 小時" : rangeValue === "7d" ? "7 天" : "30 天") +
        "共 " + points.length + " 筆資料。" + (datasets.length > 1 ? "虛線代表已設定的警報與超限門檻。" : "此測項尚未設定警報門檻。");

    cardDetailChartInstance = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            scales: {
                x: {
                    type: "time",
                    min: startTime,
                    max: endTime,
                    time: { unit: rangeValue === "30d" ? "day" : "hour", tooltipFormat: "yyyy-MM-dd HH:mm" },
                    grid: { color: gridColor },
                    ticks: { color: textColor, maxTicksLimit: window.innerWidth < 600 ? 6 : 12 }
                },
                y: {
                    beginAtZero: false,
                    grid: { color: gridColor },
                    ticks: { color: textColor },
                    title: { display: !!active.unit, text: active.unit || active.name, color: textColor }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: { color: textColor, boxWidth: 18, padding: 10, font: { size: window.innerWidth < 600 ? 10 : 12 } }
                },
                tooltip: {
                    backgroundColor: isDark ? "#222" : "#fff",
                    titleColor: isDark ? "#fff" : "#111",
                    bodyColor: isDark ? "#fff" : "#111",
                    borderColor: gridColor,
                    borderWidth: 1
                }
            }
        }
    });
}

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeCardDetail();
});
