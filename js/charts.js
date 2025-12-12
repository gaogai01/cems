// index.html的歷史趨勢圖

// ============================================================
// 1. 設定區
// ============================================================
const CHART_API_URL = "https://script.google.com/macros/s/AKfycbz7e5iwN7g122fMywsZUVF3YyOUtQWsmYzz_rO-NuKW55zpUsNUOMgKnY5bBV-6k9KM/exec";

// 全域變數
//let myChart = null;

// ============================================================
// 2. 視窗控制
// ============================================================

function openChartModal() {
    const modal = document.getElementById('chartModal');
    if(modal) modal.style.display = 'block';
    
    // 預設日期：今天
    const dateInput = document.getElementById('chartEndDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // 預設選取類別
    const catSelect = document.getElementById('categorySelect');
    if (catSelect && catSelect.value === "") catSelect.value = 'level';
    
    renderCheckboxes();
    
    // 檢查是否有歷史資料
    if (!window.historyData || !window.historyData.data || window.historyData.data.length === 0) {
        fetchHistory();
    } else {
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
    const defaultChk = document.querySelector('input[value="LI018_VAL0"]'); 
    const checked = document.querySelectorAll('#tagCheckboxes input:checked');
    if (defaultChk && checked.length === 0) {
        defaultChk.checked = true;
    }
}

// ============================================================
// 3. 資料抓取
// ============================================================

function fetchHistory() {
    const loading = document.getElementById('chartLoading');
    if(loading) loading.style.display = 'block';

    console.log("開始抓取歷史資料...");

    fetch(CHART_API_URL + "?mode=history")
        .then(response => {
            if (!response.ok) throw new Error("網路回應不正常");
            return response.json();
        })
        .then(json => {
            console.log("歷史資料抓取成功，筆數:", json.data ? json.data.length : 0);
            window.historyData = json;
            
            if(loading) loading.style.display = 'none';
            
            setTimeout(() => {
                autoSelectDefault();
                updateChart();
            }, 100);
        })
        .catch(error => {
            console.error('History Error:', error);
            if(loading) {
                loading.innerHTML = `<div style="color:red; padding:20px;">
                    歷史數據載入失敗<br>
                    <small>${error.message}</small><br>
                    <button onclick="fetchHistory()" style="margin-top:10px;">重試</button>
                </div>`;
            }
        });
}

// ============================================================
// 4. 選單與 checkbox 渲染 (已新增 回收水槽 與 氨氮)
// ============================================================

const CATEGORIES = {
    // ▼ 新增 LI011_VAL0 (回收水槽液位)
    'level': ['LIT000_VAL0','LI003_VAL0','LI012_VAL0','LI021_VAL0','LI018_VAL0', 'LI011_VAL0'], 
    'flow':  ['FI000B_Q_VAL0','FI000A_Q_VAL0','FI012_Q_VAL0','FI021W_Q_VAL0','FI018_Q_VAL0','FI018B_Q_VAL0','FI000B_Q_VAL0'], 
    'ph':    ['PHI015_VAL0','PHI013_VAL0','PHI014_VAL0','PHI017_VAL0','PHI018_VAL0'], 
    // ▼ 新增 NH3018_VAL0 (氨氮)
    'quality': ['SS018_VAL0','COD018_VAL0','OFD018_VAL0', 'NH3018_VAL0'], 
    'pac': ['LI044_VAL0','LI048_VAL0','LI049_VAL0','LI043_VAL0']
};

const TAG_NAMES = {
    'LIT000_VAL0': 'T05-01二段式API槽水位', 'LI003_VAL0': 'T05-04中間水槽水位', 'LI012_VAL0': 'T01-01調勻槽水位', 'LI021_VAL0': 'T02-01生活污水槽水位', 'LI018_VAL0': 'T01-07進水檢知槽水位',
    'FI000B_Q_VAL0': '含油廢水進口流量','FI000A_Q_VAL0': '含油廢水出口流量', 'FI012_Q_VAL0': '事業廢水流量', 'FI021W_Q_VAL0': '生活污水流量', 'FI018_Q_VAL0': '放流水流量', 'FI018B_Q_VAL0': '回收水流量',
    'PHI015_VAL0': '靜態攪拌管pH', 'PHI013_VAL0': '第一酸鹼槽PH', 'PHI014_VAL0': '膠凝槽PH', 'PHI017_VAL0': '第二酸鹼槽PH', 'PHI018_VAL0': '放流水PH',
    'SS018_VAL0': '放流水SS', 'COD018_VAL0': '放流水COD', 'OFD018_VAL0': '放流水油脂',
    'LI044_VAL0': '鹼槽液位', 'LI048_VAL0': '凝膠儲槽液位', 'LI049_VAL0': 'PAC儲槽液位', 'LI043_VAL0': '酸槽液位',
    'FI000B_Q_VAL0': 'API進口累積', 'FI000A_Q_VAL0': 'API出口累積',
    // ▼ 新增的中文對照 (若 Tag ID 不對，請修改左邊的 Key)
    'LI011_VAL0': 'T02-04回收水槽液位',
    'NH3018_VAL0': '放流水氨氮'
};

function renderCheckboxes() {
    const cat = document.getElementById('categorySelect').value;
    const container = document.getElementById('tagCheckboxes');
    if(!container) return;
    
    container.innerHTML = ""; 

    const tags = CATEGORIES[cat] || [];
    
    tags.forEach(tag => {
        const label = document.createElement('label');
        label.className = "checkbox-item";
        label.style.display = "inline-block"; 
        label.style.marginRight = "15px";
        label.style.marginBottom = "5px";
        label.style.cursor = "pointer";
        
        const input = document.createElement('input');
        input.type = "checkbox";
        input.value = tag;
        input.onchange = updateChart; 
        
        label.appendChild(input);
        label.appendChild(document.createTextNode(" " + (TAG_NAMES[tag] || tag)));
        
        container.appendChild(label);
    });
}

// ============================================================
// 5. 圖表核心繪製邏輯 (已更新日期篩選邏輯)
// ============================================================

function updateChart() {
    if (!window.historyData || !window.historyData.data) return;

    const checkedBoxes = document.querySelectorAll('#tagCheckboxes input:checked');
    const selectedTags = Array.from(checkedBoxes).map(cb => cb.value);

    const ctxCanvas = document.getElementById('historyChart');
    if(!ctxCanvas) return;
    const ctx = ctxCanvas.getContext('2d');
    
    if (selectedTags.length === 0) {
        if (myChart) {
            myChart.data.datasets = [];
            myChart.update();
        }
        return;
    }

    const headers = window.historyData.headers;
    const rows = window.historyData.data;

    // Tag 索引
    const tagIndices = selectedTags.map(tag => {
        return { tag: tag, index: headers.indexOf(tag) };
    });

    const datasets = [];
    const colors = ['#3f51b5', '#e91e63', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#795548'];
    
    // --- 📅 時間篩選邏輯開始 ---
    const rangeSelect = document.getElementById('timeRangeSelect');
    const dateInput = document.getElementById('chartEndDate');
    
    const range = rangeSelect ? rangeSelect.value : '24h';
    let endTime = new Date();
    
    // 若有選擇結束日期，設定為該日期的 23:59:59
    if (dateInput && dateInput.value) {
        endTime = new Date(dateInput.value);
        endTime.setHours(23, 59, 59, 999);
    }

    // 計算開始時間 (StartTime)
    let startTime = new Date(endTime);
    if (range === '24h') startTime.setHours(endTime.getHours() - 24);
    else if (range === '7d') startTime.setDate(endTime.getDate() - 7);
    else if (range === '30d') startTime.setDate(endTime.getDate() - 30);
    
    // 篩選數據 (比對 rows[0] 時間欄位)
    let dataSlice = rows.filter(r => {
        if(!r[0]) return false;
        const d = new Date(r[0]);
        return d >= startTime && d <= endTime;
    });
    // --- 📅 時間篩選邏輯結束 ---

    // X軸 Labels
    const labels = dataSlice.map(r => {
        const d = new Date(r[0]);
        return (d.getMonth()+1) + '/' + d.getDate() + ' ' + 
               d.getHours().toString().padStart(2,'0') + ':00';
    });

    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? '#444' : '#ddd';
    const textColor = isDark ? '#eee' : '#666';

    tagIndices.forEach((item, i) => {
        if (item.index > -1) {
            const dataPoints = dataSlice.map(r => {
                const val = parseFloat(r[item.index]);
                return isNaN(val) ? null : val;
            });
            
            datasets.push({
                label: TAG_NAMES[item.tag] || item.tag,
                data: dataPoints,
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length],
                borderWidth: 2,
                pointRadius: 1, 
                fill: false,
                tension: 0.3 
            });
        }
    });

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    ticks: { maxTicksLimit: 12, maxRotation: 0, color: textColor },
                    grid: { color: gridColor }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor },
                    beginAtZero: false 
                }
            },
            plugins: {
                legend: { labels: { color: textColor } }
            }
        }
    });
}

// 綁定視窗關閉事件
window.addEventListener('click', function(event) {
    const modal = document.getElementById('chartModal');
    if (event.target == modal) {
        closeChartModal();
    }
});
