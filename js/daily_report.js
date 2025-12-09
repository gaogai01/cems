// js/daily_report.js
// ⚠️ 請確認這是您正確的 GAS 網址
const API_URL = "https://script.google.com/macros/s/AKfycbzJzoU4IyAc6CeKydjbM8iYVyPMsFvMfoR_I50OT7vyNPpH7BZBjlWGEt_DdnUtlUw/exec";
// 獨立的快取變數，避免與主程式衝突
let _reportCache = null;

// ============================================================
// 1. 開啟/關閉視窗
// ============================================================
function openReportModal() {
    document.getElementById('reportModal').style.display = 'block';
    // 預設填入當前月份
    const monthInput = document.getElementById('reportMonth');
    if (!monthInput.value) {
        monthInput.value = new Date().toISOString().slice(0, 7);
    }
}

function closeReportModal() {
    document.getElementById('reportModal').style.display = 'none';
}

// 點擊視窗外部關閉 (針對報表 Modal)
window.addEventListener('click', function(event) {
    const modal = document.getElementById('reportModal');
    if (event.target == modal) {
        closeReportModal();
    }
});

// ============================================================
// 2. 報表計算與生成 (核心邏輯)
// ============================================================
function updateReportPreview() {
    const month = document.getElementById('reportMonth').value;
    if (!month) { alert("請選擇月份"); return; }

    document.getElementById('reportPreview').innerHTML = "數據載入與計算中...";

    // 使用全域變數 API_URL (請確保 daily.html 或 config.js 有定義)
    const p = _reportCache ? Promise.resolve(_reportCache) : fetch(API_URL + "?mode=history").then(r => r.json());

    p.then(json => {
        _reportCache = json; // 更新快取
        const rows = json.data; // 原始數據
        const [yyyy, mm] = month.split('-');
        
        let html = `
        <div style="font-family:'BiauKai', serif; padding:20px;">
            <h2 style="text-align:center; margin-bottom:10px;">尖山發電廠 ${yyyy}年${mm}月 運轉月報表</h2>
            <table class="report-table" style="width:100%; border-collapse:collapse; text-align:center;">
                <thead>
                    <tr style="background:#f0f0f0;">
                        <th style="border:1px solid #000; padding:5px;">日期</th>
                        <th style="border:1px solid #000; padding:5px;">海淡水產量 (噸)</th>
                        <th style="border:1px solid #000; padding:5px;">造水機產量 (噸)</th>
                        <th style="border:1px solid #000; padding:5px;">尿素使用量 (噸)</th>
                        <th style="border:1px solid #000; padding:5px;">備註</th>
                    </tr>
                </thead>
                <tbody>`;

        // 統計變數
        let sumDesal = 0, sumGenWater = 0, sumUrea = 0;
        let daysCount = 0; // 有紀錄的天數

        // 取得當月天數
        const daysInMonth = new Date(yyyy, mm, 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
            // 格式化日期字串 (YYYY-MM-DD) 以便比對
            const dateKey = `${yyyy}-${mm}-${d.toString().padStart(2, '0')}`;
            
            // 在歷史資料中尋找當天的紀錄 (比對 row[0] 時間欄位)
            // 假設 row[0] 是 ISO 格式或 "YYYY/MM/DD HH:mm:ss"
            const row = rows.find(r => r[0].startsWith(dateKey.replace(/-/g, '/')) || r[0].startsWith(dateKey));

            let valDesal = 0, valGenWater = 0, valUrea = 0;
            let note = "";

            if (row) {
                // 依據 daily.html 的欄位定義：
                // row[13]: 海淡水 (N欄)
                // row[14]: 造水機 (O欄)
                // row[18]: 尿素 (S欄) - *請確認這是否對應 S 欄*
                
                valDesal = parseFloat(row[13]) || 0;
                valGenWater = parseFloat(row[14]) || 0;
                valUrea = parseFloat(row[18]) || 0; 
                
                // 如果有數據才列入統計 (避免空值拉低平均)
                // 這裡假設 row[11] (L欄/總鹼價) 有值代表當天有巡查紀錄
                if (row[11]) daysCount++; 
            }

            sumDesal += valDesal;
            sumGenWater += valGenWater;
            sumUrea += valUrea;

            html += `
                <tr>
                    <td style="border:1px solid #000;">${d}</td>
                    <td style="border:1px solid #000;">${valDesal > 0 ? valDesal : '-'}</td>
                    <td style="border:1px solid #000;">${valGenWater > 0 ? valGenWater : '-'}</td>
                    <td style="border:1px solid #000;">${valUrea > 0 ? valUrea : '-'}</td>
                    <td style="border:1px solid #000;">${note}</td>
                </tr>`;
        }

        // 計算平均 (除以當月天數 或 有紀錄天數，這裡範例除以當月天數)
        // 若要除以有紀錄天數，請改用 daysCount
        const avgDivisor = daysInMonth; 

        html += `
                <tr style="background:#e8f5e9; font-weight:bold;">
                    <td style="border:1px solid #000;">總計</td>
                    <td style="border:1px solid #000;">${sumDesal.toFixed(1)}</td>
                    <td style="border:1px solid #000;">${sumGenWater.toFixed(1)}</td>
                    <td style="border:1px solid #000;">${sumUrea.toFixed(2)}</td>
                    <td style="border:1px solid #000;"></td>
                </tr>
                <tr style="background:#fff3e0; font-weight:bold;">
                    <td style="border:1px solid #000;">平均</td>
                    <td style="border:1px solid #000;">${(sumDesal / avgDivisor).toFixed(1)}</td>
                    <td style="border:1px solid #000;">${(sumGenWater / avgDivisor).toFixed(1)}</td>
                    <td style="border:1px solid #000;">${(sumUrea / avgDivisor).toFixed(2)}</td>
                    <td style="border:1px solid #000;"></td>
                </tr>
                </tbody>
            </table>
            <div style="margin-top:20px; text-align:right;">製表日期：${new Date().toLocaleDateString()}</div>
        </div>`;

        document.getElementById('reportPreview').innerHTML = html;

    }).catch(e => {
        console.error(e);
        document.getElementById('reportPreview').innerHTML = `<span style="color:red;">讀取失敗：${e.message}</span>`;
    });
}

// ============================================================
// 3. 匯出與列印
// ============================================================
function exportToExcel() {
    const div = document.getElementById('reportPreview');
    if (!div || div.innerText.includes("數據載入")) {
        alert("請先產生報表");
        return;
    }
    
    const month = document.getElementById('reportMonth').value;
    const filename = `尖山電廠運轉月報表_${month}.xls`;
    
    // 加入 Excel XML 表頭以支援中文與格線
    const template = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:x="urn:schemas-microsoft-com:office:excel" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="UTF-8">
            <style>
                table { border-collapse: collapse; }
                td, th { border: 0.5pt solid black; text-align: center; }
                .num { mso-number-format:General; }
            </style>
        </head>
        <body>
            ${div.innerHTML}
        </body>
        </html>`;

    const blob = new Blob([template], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function printReport() {
    const content = document.getElementById('reportPreview').innerHTML;
    const printWindow = window.open('', '', 'height=800,width=1000');
    
    printWindow.document.write(`
        <html>
        <head>
            <title>列印月報表</title>
            <style>
                body { font-family: "BiauKai", "DFKai-SB", serif; margin: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid black; padding: 4px; text-align: center; }
                @media print {
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            ${content}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}
