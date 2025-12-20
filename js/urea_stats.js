// ==========================================
// 📊 尿素用量統計前端腳本 (urea_stats.js)
// ==========================================

// ★ 請確認這裡填入的是最新的 GAS Web App 網址
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwPLWcCJhnE_ZnnIbCgk9hNcjo6ikLDR_rzFGCiBFPamXapAj3e-fg1YiJo1THW08T4/exec"; 

document.addEventListener("DOMContentLoaded", function() {
    initUreaChart();
});

function initUreaChart() {
    const ctx = document.getElementById('ureaChart');
    if (!ctx) return; 

    // 顯示載入狀態
    const statusDiv = document.getElementById('ureaStatus');
    if(statusDiv) statusDiv.innerHTML = '<span class="badge bg-secondary">數據載入中...</span>';

    // 呼叫後端 API (mode=urea_stats)
    fetch(GAS_API_URL + "?mode=urea_stats")
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert("錯誤: " + data.error);
            return;
        }
        if(statusDiv) statusDiv.innerHTML = ''; // 清除載入文字
        renderChart(data);
        renderTodayTable(data);
    })
    .catch(error => {
        console.error('Error:', error);
        if(statusDiv) statusDiv.innerHTML = '<span class="badge bg-danger">載入失敗</span>';
    });
}

function renderChart(data) {
    const ctx = document.getElementById('ureaChart').getContext('2d');
    
    // X 軸: 日期
    const labels = data.map(item => item.date);

    // Y 軸: 全廠每日總用量 (將 M1~M12 加總)
    const totalUsage = data.map(item => {
        let sum = 0;
        for (let i = 1; i <= 12; i++) {
            sum += item[`M${i}`] || 0;
        }
        return sum.toFixed(1);
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '全廠尿素每日總用量 (公升)',
                data: totalUsage,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: '用量 (L)' } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        // 滑鼠移上去顯示各機組細節
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

// 建立簡單表格顯示「最新一天」的數據
function renderTodayTable(data) {
    const tableDiv = document.getElementById('ureaTableContainer');
    if (!tableDiv || data.length === 0) return;

    // 取最後一筆 (最新日期)
    const lastDay = data[data.length - 1]; 

    let html = `<h6 class="mt-3">📅 ${lastDay.date} 各機組用量明細</h6>
                <table class="table table-bordered table-sm text-center" style="font-size: 0.9rem;">
                <thead class="table-light">
                    <tr><th>機組</th><th>用量(L)</th><th>機組</th><th>用量(L)</th></tr>
                </thead>
                <tbody>`;
    
    // 兩欄一列的方式顯示 (M1, M2 一列)
    for(let i=1; i<=12; i+=2) {
        let v1 = lastDay[`M${i}`];
        let v2 = lastDay[`M${i+1}`];
        
        // 有數值顯示藍色，0 顯示灰色
        let c1 = v1 > 0 ? "text-primary fw-bold" : "text-muted";
        let c2 = v2 > 0 ? "text-primary fw-bold" : "text-muted";

        html += `<tr>
                    <td>#${i}</td> <td class="${c1}">${v1}</td>
                    <td>#${i+1}</td> <td class="${c2}">${v2}</td>
                 </tr>`;
    }
    html += `</tbody></table>`;
    tableDiv.innerHTML = html;
}
