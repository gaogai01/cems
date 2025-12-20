// ==========================================
// 📊 尿素用量統計前端腳本 (頁面嵌入版)
// ==========================================

// ★★★ 請確認這裡填入您的最新 GAS 網址 ★★★
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwPLWcCJhnE_ZnnIbCgk9hNcjo6ikLDR_rzFGCiBFPamXapAj3e-fg1YiJo1THW08T4/exec"; 

// 全域變數
let myUreaChart = null; 
let allUreaData = []; 
let currentDataIndex = -1; 

// 定義 12 部機組顏色
const MACHINE_COLORS = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', 
    '#E7E9ED', '#767676', '#c9cbcf', '#2E8B57', '#800000', '#000080'
];

document.addEventListener("DOMContentLoaded", function() {
    // 1. 網頁載入後，直接初始化圖表 (不再等待 Modal)
    initUreaChart();

    // 2. 綁定按鈕事件
    // 檢查元素是否存在，避免報錯
    const btnPrev = document.getElementById('btnPrevDay');
    const btnNext = document.getElementById('btnNextDay');
    const datePicker = document.getElementById('ureaDatePicker');

    if(btnPrev) btnPrev.addEventListener('click', () => changeDate(-1));
    if(btnNext) btnNext.addEventListener('click', () => changeDate(1));
    if(datePicker) datePicker.addEventListener('change', (e) => jumpToDate(e.target.value));
});

function initUreaChart() {
    const statusDiv = document.getElementById('ureaStatus');
    if(statusDiv) statusDiv.innerHTML = '<div class="spinner-border text-light spinner-border-sm"></div> <span class="ms-1">載入中...</span>';

    fetch(GAS_API_URL + "?mode=urea_stats")
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            if(statusDiv) statusDiv.innerHTML = `<span class="text-warning">⚠️ ${data.error}</span>`;
            return;
        }
        if(statusDiv) statusDiv.innerHTML = ''; // 清除 Loading 文字
        
        allUreaData = data; 
        
        // 預設顯示最新一天
        if (allUreaData.length > 0) {
            currentDataIndex = allUreaData.length - 1;
            renderStackedChart(data);
            updateDetailView(); 
        } else {
            if(statusDiv) statusDiv.innerHTML = '無數據';
        }
    })
    .catch(error => {
        console.error('Error:', error);
        if(statusDiv) statusDiv.innerHTML = '<span class="text-warning">連線失敗</span>';
    });
}

function renderStackedChart(data) {
    const ctx = document.getElementById('ureaChart');
    if (!ctx) return; // 防呆

    if (myUreaChart) myUreaChart.destroy();

    const labels = data.map(item => item.date);
    const datasets = [];

    for (let i = 1; i <= 12; i++) {
        const mKey = `M${i}`;
        const mData = data.map(item => item[mKey] || 0);

        datasets.push({
            label: `#${i}機`,
            data: mData,
            backgroundColor: MACHINE_COLORS[i-1],
            stack: 'Stack 0',
        });
    }

    myUreaChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true, title: { display: true, text: '總用量 (L)' } }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    currentDataIndex = elements[0].index;
                    updateDetailView();
                }
            },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10 } },
                tooltip: {
                    callbacks: {
                        footer: (tooltipItems) => {
                            let sum = 0;
                            tooltipItems.forEach((t) => sum += t.raw);
                            return '總計: ' + sum.toFixed(1) + ' L';
                        }
                    }
                }
            }
        }
    });
}

// --- 以下功能邏輯不變 ---
function changeDate(offset) {
    const newIndex = currentDataIndex + offset;
    if (newIndex >= 0 && newIndex < allUreaData.length) {
        currentDataIndex = newIndex;
        updateDetailView();
    } else {
        alert("已無更多資料");
    }
}

function jumpToDate(dateStr) {
    const index = allUreaData.findIndex(item => item.date === dateStr);
    if (index !== -1) {
        currentDataIndex = index;
        updateDetailView();
    } else {
        alert("無此日期的數據");
    }
}

function updateDetailView() {
    if (currentDataIndex < 0 || allUreaData.length === 0) return;
    const currentDayData = allUreaData[currentDataIndex];
    
    document.getElementById('ureaDatePicker').value = currentDayData.date;
    document.getElementById('btnPrevDay').disabled = (currentDataIndex === 0);
    document.getElementById('btnNextDay').disabled = (currentDataIndex === allUreaData.length - 1);

    renderTable(currentDayData);
}

function renderTable(dayData) {
    const tableDiv = document.getElementById('ureaTableContainer');
    let total = 0;
    for(let i=1; i<=12; i++) total += (dayData[`M${i}`] || 0);

    let html = `<h6 class="fw-bold mt-2 text-center text-primary">
                    📅 ${dayData.date} 明細 (總計: ${total.toFixed(1)} L)
                </h6>
                <table class="table table-bordered table-sm text-center align-middle" style="font-size: 0.9rem;">
                <thead class="table-light">
                    <tr>
                        <th style="width:15%">機組</th><th style="width:35%">用量(L)</th>
                        <th style="width:15%">機組</th><th style="width:35%">用量(L)</th>
                    </tr>
                </thead>
                <tbody>`;
    
    for(let i=1; i<=12; i+=2) {
        let v1 = dayData[`M${i}`];
        let v2 = dayData[`M${i+1}`];
        let s1 = v1 > 0 ? `color:${MACHINE_COLORS[i-1]}; font-weight:bold;` : "color:#ccc;";
        let s2 = v2 > 0 ? `color:${MACHINE_COLORS[i]}; font-weight:bold;` : "color:#ccc;";

        html += `<tr>
                    <td>#${i}</td> <td style="${s1}">${v1}</td>
                    <td>#${i+1}</td> <td style="${s2}">${v2}</td>
                 </tr>`;
    }
    html += `</tbody></table>`;
    tableDiv.innerHTML = html;
}
