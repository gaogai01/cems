// ==========================================
// 📊 尿素用量統計前端腳本 (堆疊圖 + 日期導航版)
// ==========================================

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwPLWcCJhnE_ZnnIbCgk9hNcjo6ikLDR_rzFGCiBFPamXapAj3e-fg1YiJo1THW08T4/exec"; 

// 全域變數
let myUreaChart = null; 
let allUreaData = []; // 儲存抓回來的原始資料
let currentDataIndex = -1; // 目前選中的資料索引 (對應 allUreaData)

// 定義 12 部機組的專屬顏色 (色碼表)
const MACHINE_COLORS = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', // M1~M6
    '#E7E9ED', '#767676', '#c9cbcf', '#2E8B57', '#800000', '#000080'  // M7~M12
];

document.addEventListener("DOMContentLoaded", function() {
    // 1. 綁定 Modal 事件
    const ureaModal = document.getElementById('ureaModal');
    if (ureaModal) {
        ureaModal.addEventListener('shown.bs.modal', function () {
            if (allUreaData.length === 0) {
                initUreaChart();
            }
        });
    }

    // 2. 綁定日期控制按鈕事件
    document.getElementById('btnPrevDay').addEventListener('click', () => changeDate(-1));
    document.getElementById('btnNextDay').addEventListener('click', () => changeDate(1));
    document.getElementById('ureaDatePicker').addEventListener('change', (e) => jumpToDate(e.target.value));
});

function initUreaChart() {
    const statusDiv = document.getElementById('ureaStatus');
    if(statusDiv) statusDiv.innerHTML = '<div class="spinner-border text-success spinner-border-sm"></div> 數據載入中...';

    fetch(GAS_API_URL + "?mode=urea_stats")
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            if(statusDiv) statusDiv.innerHTML = `<span class="text-danger">❌ ${data.error}</span>`;
            return;
        }
        if(statusDiv) statusDiv.innerHTML = '';
        
        allUreaData = data; // 存入全域變數
        
        // 預設顯示「最新一天」
        currentDataIndex = allUreaData.length - 1;
        
        renderStackedChart(data);
        updateDetailView(); // 更新表格與日期顯示
    })
    .catch(error => {
        console.error('Error:', error);
        if(statusDiv) statusDiv.innerHTML = '<span class="text-danger">連線失敗</span>';
    });
}

// 繪製堆疊長條圖
function renderStackedChart(data) {
    const ctx = document.getElementById('ureaChart').getContext('2d');
    if (myUreaChart) myUreaChart.destroy();

    const labels = data.map(item => item.date);

    // 準備 12 個 Dataset (M1 ~ M12)
    const datasets = [];
    for (let i = 1; i <= 12; i++) {
        const mKey = `M${i}`;
        // 抓取每一天該機組的數值
        const mData = data.map(item => item[mKey] || 0);

        datasets.push({
            label: `#${i}機`,
            data: mData,
            backgroundColor: MACHINE_COLORS[i-1], // 對應顏色
            stack: 'Stack 0', // 設定為同一組堆疊
        });
    }

    myUreaChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index', // 滑鼠移上去時顯示當天所有機組
                intersect: false,
            },
            scales: {
                x: { stacked: true }, // X軸堆疊
                y: { 
                    stacked: true,    // Y軸堆疊
                    beginAtZero: true,
                    title: { display: true, text: '總用量 (L)' } 
                }
            },
            onClick: (e, elements) => {
                // 點擊圖表切換下方表格日期
                if (elements.length > 0) {
                    const index = elements[0].index;
                    currentDataIndex = index;
                    updateDetailView();
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        footer: function(tooltipItems) {
                            let sum = 0;
                            tooltipItems.forEach(function(tooltipItem) {
                                sum += tooltipItem.raw;
                            });
                            return '全廠總計: ' + sum.toFixed(1) + ' L';
                        }
                    }
                },
                legend: {
                    position: 'bottom', // 圖例放下面比較不擋路
                    labels: { boxWidth: 12, font: { size: 10 } }
                }
            }
        }
    });
}

// --- 日期導航邏輯 ---

// 按鈕切換 (+1 或 -1)
function changeDate(offset) {
    const newIndex = currentDataIndex + offset;
    // 邊界檢查
    if (newIndex >= 0 && newIndex < allUreaData.length) {
        currentDataIndex = newIndex;
        updateDetailView();
    } else {
        alert("已經是第一筆或最後一筆資料了！");
    }
}

// 日期選擇器跳轉
function jumpToDate(dateStr) {
    // 尋找對應日期的索引
    const index = allUreaData.findIndex(item => item.date === dateStr);
    if (index !== -1) {
        currentDataIndex = index;
        updateDetailView();
    } else {
        alert("無此日期的數據 (可能非最近30日)");
    }
}

// 更新下方的表格與日期顯示
function updateDetailView() {
    if (currentDataIndex < 0 || allUreaData.length === 0) return;

    const currentDayData = allUreaData[currentDataIndex];
    
    // 1. 同步更新日期選擇器
    document.getElementById('ureaDatePicker').value = currentDayData.date;

    // 2. 判斷按鈕是否該停用 (Disable)
    document.getElementById('btnPrevDay').disabled = (currentDataIndex === 0);
    document.getElementById('btnNextDay').disabled = (currentDataIndex === allUreaData.length - 1);

    // 3. 繪製表格
    renderTable(currentDayData);
}

function renderTable(dayData) {
    const tableDiv = document.getElementById('ureaTableContainer');
    
    // 計算當日總量
    let total = 0;
    for(let i=1; i<=12; i++) total += (dayData[`M${i}`] || 0);

    let html = `<h6 class="fw-bold mt-2 text-center text-primary">
                    📅 ${dayData.date} 明細 (全廠總計: ${total.toFixed(1)} L)
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
        
        // 有數值顯示顏色，並加粗
        // 顏色使用圖表定義的顏色，增加辨識度
        let style1 = v1 > 0 ? `color:${MACHINE_COLORS[i-1]}; font-weight:bold;` : "color:#ccc;";
        let style2 = v2 > 0 ? `color:${MACHINE_COLORS[i]}; font-weight:bold;` : "color:#ccc;";

        html += `<tr>
                    <td>#${i}</td> <td style="${style1}">${v1}</td>
                    <td>#${i+1}</td> <td style="${style2}">${v2}</td>
                 </tr>`;
    }
    html += `</tbody></table>`;
    tableDiv.innerHTML = html;
}
