// ==========================================
// 📊 尿素用量統計前端腳本 (Modal 優化版)
// ==========================================

// ★ 請確認填入您的最新 GAS 網址
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwPLWcCJhnE_ZnnIbCgk9hNcjo6ikLDR_rzFGCiBFPamXapAj3e-fg1YiJo1THW08T4/exec"; 

// 定義全域變數，避免重複宣告
let myUreaChart = null; 
let isUreaDataLoaded = false; // 避免每次打開都重新抓資料

document.addEventListener("DOMContentLoaded", function() {
    // 監聽 Modal 打開的事件 (shown.bs.modal)
    // 這樣可以確保視窗完全跳出來後，圖表才開始畫，寬度才會正確
    const ureaModal = document.getElementById('ureaModal');
    if (ureaModal) {
        ureaModal.addEventListener('shown.bs.modal', function () {
            // 如果還沒載入過資料，就執行載入
            if (!isUreaDataLoaded) {
                initUreaChart();
            }
        });
    }
});

function initUreaChart() {
    const ctx = document.getElementById('ureaChart');
    if (!ctx) return; 

    // 顯示載入狀態
    const statusDiv = document.getElementById('ureaStatus');
    if(statusDiv) statusDiv.innerHTML = '<div class="spinner-border text-success" role="status"><span class="visually-hidden">Loading...</span></div> <span class="ms-2">數據載入中...</span>';

    // 呼叫後端 API
    fetch(GAS_API_URL + "?mode=urea_stats")
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            if(statusDiv) statusDiv.innerHTML = `<span class="text-danger">❌ ${data.error}</span>`;
            return;
        }
        if(statusDiv) statusDiv.innerHTML = ''; // 清除載入文字
        
        renderChart(data);
        renderTodayTable(data);
        isUreaDataLoaded = true; // 標記已載入，下次打開不用重抓(除非重整網頁)
    })
    .catch(error => {
        console.error('Error:', error);
        if(statusDiv) statusDiv.innerHTML = '<span class="text-danger">連線失敗，請檢查網路</span>';
    });
}

function renderChart(data) {
    const ctx = document.getElementById('ureaChart').getContext('2d');
    
    // 如果舊圖表存在，先銷毀 (防止滑鼠移上去數值亂跳)
    if (myUreaChart) {
        myUreaChart.destroy();
    }

    const labels = data.map(item => item.date);
    const totalUsage = data.map(item => {
        let sum = 0;
        for (let i = 1; i <= 12; i++) sum += item[`M${i}`] || 0;
        return sum.toFixed(1);
    });

    myUreaChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '全廠尿素每日總用量 (公升)',
                data: totalUsage,
                backgroundColor: 'rgba(25, 135, 84, 0.6)', // 改成綠色系配合環保
                borderColor: 'rgba(25, 135, 84, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // 讓圖表填滿 Modal 高度
            scales: {
                y: { beginAtZero: true, title: { display: true, text: '用量 (L)' } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterBody: function(context) {
                            const index = context[0].dataIndex;
                            const dayData = data[index];
                            let str = "\n--- 各機組用量 (L) ---\n";
                            let hasData = false;
                            for(let i=1; i<=12; i++) {
                                let val = dayData[`M${i}`];
                                if(val > 0) {
                                    str += `#${i}號機: ${val}\n`;
                                    hasData = true;
                                }
                            }
                            return hasData ? str : "\n無消耗紀錄";
                        }
                    }
                }
            }
        }
    });
}

function renderTodayTable(data) {
    const tableDiv = document.getElementById('ureaTableContainer');
    if (!tableDiv || data.length === 0) return;

    const lastDay = data[data.length - 1]; 

    let html = `<h6 class="fw-bold">📅 ${lastDay.date} 各機組用量明細</h6>
                <table class="table table-bordered table-striped table-sm text-center align-middle">
                <thead class="table-success">
                    <tr><th>機組</th><th>用量(L)</th><th>機組</th><th>用量(L)</th></tr>
                </thead>
                <tbody>`;
    
    for(let i=1; i<=12; i+=2) {
        let v1 = lastDay[`M${i}`];
        let v2 = lastDay[`M${i+1}`];
        let c1 = v1 > 0 ? "text-success fw-bold" : "text-muted";
        let c2 = v2 > 0 ? "text-success fw-bold" : "text-muted";

        html += `<tr>
                    <td>#${i}</td> <td class="${c1}">${v1}</td>
                    <td>#${i+1}</td> <td class="${c2}">${v2}</td>
                 </tr>`;
    }
    html += `</tbody></table>`;
    tableDiv.innerHTML = html;
}
