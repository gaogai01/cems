// ==========================================
// 📊 尿素用量統計 (顏色分組 + 橫向表格版)
// ==========================================

// ★★★ 請確認這裡填入您的最新 GAS 網址 ★★★
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwPLWcCJhnE_ZnnIbCgk9hNcjo6ikLDR_rzFGCiBFPamXapAj3e-fg1YiJo1THW08T4/exec"; ; 

// 全域變數
let myUreaChart = null; 
let allUreaData = []; 
let currentDataIndex = -1; 

// --- 🎨 顏色設定 (依照需求分組) ---
const MACHINE_COLORS = [
    // 1~4 機: 橘黃色系 (金黃 -> 橘 -> 深橘紅)
    '#FFD700', '#FFB347', '#FF8C00', '#FF4500', 
    // 5~8 機: 綠色系 (淺綠 -> 萊姆綠 -> 森林綠 -> 深綠)
    '#90EE90', '#32CD32', '#228B22', '#006400', 
    // 9~12 機: 藍色系 (天藍 -> 鋼青 -> 寶藍 -> 深藍)
    '#87CEEB', '#4682B4', '#0000FF', '#00008B'
];

document.addEventListener("DOMContentLoaded", function() {
    initUreaChart();

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
        if(statusDiv) statusDiv.innerHTML = '';
        
        allUreaData = data; 
        
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
    if (!ctx) return; 

    if (myUreaChart) myUreaChart.destroy();

    const labels = data.map(item => item.date);
    const datasets = [];

    for (let i = 1; i <= 12; i++) {
        const mKey = `M${i}`;
        const mData = data.map(item => item[mKey] || 0);

        datasets.push({
            label: `#${i}`, // 圖例簡化，只顯示數字
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
                x: { 
                    stacked: true,
                    grid: { display: false } // 讓 X 軸乾淨點
                },
                y: { 
                    stacked: true, 
                    beginAtZero: true, 
                    title: { display: true, text: '總用量 (L)' } 
                }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    currentDataIndex = elements[0].index;
                    updateDetailView();
                }
            },
            plugins: {
                legend: { 
                    position: 'bottom', 
                    labels: { 
                        boxWidth: 10, 
                        padding: 15,
                        font: { size: 11 }
                    } 
                },
                tooltip: {
                    callbacks: {
                        footer: (tooltipItems) => {
                            let sum = 0;
                            tooltipItems.forEach((t) => sum += t.raw);
                            return '全廠總計: ' + sum.toFixed(1) + ' L';
                        }
                    }
                }
            }
        }
    });
}

function changeDate(offset) {
    const newIndex = currentDataIndex + offset;
    if (newIndex >= 0 && newIndex < allUreaData.length) {
        currentDataIndex = newIndex;
        updateDetailView();
    } else {
        // 到頂或到底時，按鈕會有視覺回饋，這裡不跳 alert 干擾
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

// --- 🔄 表格繪製邏輯 (更新：橫向排列 1~12) ---
function renderTable(dayData) {
    const tableDiv = document.getElementById('ureaTableContainer');
    let total = 0;
    for(let i=1; i<=12; i++) total += (dayData[`M${i}`] || 0);

    // 組合 HTML
    let html = `
        <h6 class="fw-bold text-center mb-2" style="color: #555;">
            📅 ${dayData.date} 用量明細表
        </h6>
        <table class="table table-bordered table-sm text-center align-middle" style="font-size: 0.85rem; min-width: 600px;">
            <thead class="table-light">
                <tr>
                    <th class="bg-light">機組</th>`;
    
    // 產生表頭 #1 ~ #12
    for(let i=1; i<=12; i++) {
        // 使用對應的顏色當作表頭底色 (但在文字上做效果比較好看，這裡用簡單的底色)
        html += `<th>#${i}</th>`;
    }
    html += `<th class="table-dark text-white">總計</th>
            </tr>
            </thead>
            <tbody>
            <tr>
                <td class="fw-bold bg-light">用量</td>`;
    
    // 產生數據欄位
    for(let i=1; i<=12; i++) {
        let val = dayData[`M${i}`] || 0;
        let colorStyle = val > 0 ? `color:${MACHINE_COLORS[i-1]}; font-weight:900;` : "color:#ccc;";
        html += `<td style="${colorStyle}">${val}</td>`;
    }

    // 總計欄位
    html += `<td class="fw-bold text-danger">${total.toFixed(1)}</td>
            </tr>
            </tbody>
        </table>`;
    
    tableDiv.innerHTML = html;
}
