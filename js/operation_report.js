// js/operation_report.js

/**
 * 開啟操作紀錄表視窗
 */
function openOpReport() {
    document.getElementById('opReportModal').style.display = 'block';
    // 預設當前月份
    if(!document.getElementById('opReportMonth').value) {
        document.getElementById('opReportMonth').value = new Date().toISOString().slice(0, 7);
    }
}

/**
 * 關閉操作紀錄表視窗
 */
function closeOpReport() {
    document.getElementById('opReportModal').style.display = 'none';
}

/**
 * 產生操作紀錄表
 */
function generateOpReport() {
    const monthStr = document.getElementById('opReportMonth').value;
    if (!monthStr) return alert("請選擇月份");
    
    document.getElementById('opReportPreview').innerHTML = "數據計算中... (讀取歷史資料)";

    // 取得歷史資料 (快取優先)
    const p = (typeof cachedHistory !== 'undefined' && cachedHistory) ? 
              Promise.resolve(cachedHistory) : 
              fetch(API_URL + "?mode=history").then(r => r.json());

    p.then(data => {
        // 更新全域快取
        if(typeof window.cachedHistory === 'undefined' || !window.cachedHistory) window.cachedHistory = data;

        const [targetY, targetM] = monthStr.split('-').map(Number);
        const daysInMonth = new Date(targetY, targetM, 0).getDate();
        
        // 1. 初始化每日統計容器
        const dayStats = {};
        for(let i=1; i<=daysInMonth; i++) {
            dayStats[i] = { 
                // 水位平均 (Sum/Count)
                apiL:{s:0,c:0}, midL:{s:0,c:0}, indL:{s:0,c:0}, domL:{s:0,c:0},
                // pH平均
                mixP:{s:0,c:0}, ph1:{s:0,c:0}, flocP:{s:0,c:0}, ph2:{s:0,c:0}, disP:{s:0,c:0},
                
                // 流量 (Max/Min) -> 用於計算 累積/日量
                oilQ:{max:-1, min:Infinity},  // 含油事業廢水 (FI000A) - 新增
                indQ:{max:-1, min:Infinity},  // 事業廢水 (FI012)
                domQ:{max:-1, min:Infinity},  // 生活污水 (FI021W)
                disQ:{max:-1, min:Infinity},  // 放流水 (FI018)
                recQ:{max:-1, min:Infinity}   // 回收水 (FI018B)
            };
        }

        // 2. 欄位索引對照 (對應 config.js 中的 Tag ID)
        const h = data.headers;
        const idx = {
            // 水位 (cm -> m)
            apiL: h.indexOf("LIT000_VAL0"), 
            midL: h.indexOf("LI003_VAL0"),  
            indL: h.indexOf("LI012_VAL0"),  
            domL: h.indexOf("LI021_VAL0"),  
            
            // pH
            mixP: h.indexOf("PHI015_VAL0"), 
            ph1:  h.indexOf("PHI013_VAL0"), 
            flocP:h.indexOf("PHI014_VAL0"), 
            ph2:  h.indexOf("PHI017_VAL0"), 
            disP: h.indexOf("PHI018_VAL0"), 

            // 流量
            oilQ: h.indexOf("FI000A_Q_VAL0"), // 含油事業廢水 (新增)
            indQ: h.indexOf("FI012_Q_VAL0"),  // 事業廢水
            domQ: h.indexOf("FI021W_Q_VAL0"), // 生活污水
            disQ: h.indexOf("FI018_Q_VAL0"),  // 放流水
            recQ: h.indexOf("FI018B_Q_VAL0")  // 回收水
        };

        // 3. 遍歷數據並統計
        data.data.forEach(row => {
            const timeStr = row[0].replace(/-/g, "/");
            const d = new Date(timeStr);
            
            if (d.getFullYear() === targetY && (d.getMonth()+1) === targetM) {
                const day = d.getDate();
                const s = dayStats[day];

                // 處理水位 (除以100轉公尺)
                ['apiL', 'midL', 'indL', 'domL'].forEach(k => {
                    let val = parseFloat(row[idx[k]]);
                    if(!isNaN(val)) { s[k].s += (val/100); s[k].c++; }
                });
                // 處理 pH
                ['mixP', 'ph1', 'flocP', 'ph2', 'disP'].forEach(k => {
                    let val = parseFloat(row[idx[k]]);
                    if(!isNaN(val) && val > 0) { s[k].s += val; s[k].c++; }
                });

                // 處理流量 (找當日最大與最小)
                ['oilQ', 'indQ', 'domQ', 'disQ', 'recQ'].forEach(k => {
                    let val = parseFloat(row[idx[k]]);
                    if(!isNaN(val) && val > 0) {
                        if (val > s[k].max) s[k].max = val;
                        if (val < s[k].min) s[k].min = val;
                    }
                });
            }
        });

        // 4. 輔助函式：產生帶有紅字警示的 HTML
        const renderCell = (val, type) => {
            if (val === "-" || val === "") return "-";
            const num = parseFloat(val);
            let isError = false;

            // 判斷標準
            if (type === 'ph') {
                if (num < 6 || num > 9) isError = true;
            } else if (type === 'level_api') {
                if (num >= 1.4) isError = true;
            } else if (type === 'level_mid') {
                if (num >= 0.95) isError = true;
            } else if (type === 'level_ind') {
                if (num >= 2.1) isError = true;
            } else if (type === 'level_dom') {
                if (num >= 4.0) isError = true;
            } else if (type === 'flow_oil') {
                if (num >= 20) isError = true;
            } else if (type === 'flow_ind') {
                if (num >= 24) isError = true;
            } else if (type === 'flow_dom') {
                if (num >= 16) isError = true;
            } else if (type === 'flow_dis') {
                if (num >= 40) isError = true;
            } else if (type === 'flow_rec') {
                if (num >= 40) isError = true;
            }

            return isError ? `<span style="color:red; font-weight:bold;">${val}</span>` : val;
        };

        // 5. 生成表格列
        let rows = "";
        
        // 平均值計算
        const getAvg = (s, k, fix=1) => s[k].c > 0 ? (s[k].s / s[k].c).toFixed(fix) : "-";
        // 累積計算 (Max)
        const getCum = (s, k) => s[k].max > -1 ? s[k].max.toFixed(0) : "-";
        // 日量計算 (Max - Min)
        const getDay = (s, k) => (s[k].max > -1 && s[k].min !== Infinity) ? (s[k].max - s[k].min).toFixed(1) : "-";

        for(let i=1; i<=daysInMonth; i++) {
            const s = dayStats[i];
            
            rows += `
            <tr style="height: 30px;">
                <td>${i}</td>
                
                <td>${renderCell(getAvg(s, 'apiL', 2), 'level_api')}</td>
                <td>${renderCell(getAvg(s, 'midL', 2), 'level_mid')}</td>
                <td>${renderCell(getAvg(s, 'indL', 2), 'level_ind')}</td>
                <td>${renderCell(getAvg(s, 'domL', 2), 'level_dom')}</td>
                
                <td>${renderCell(getAvg(s, 'mixP'), 'ph')}</td>
                <td>${renderCell(getAvg(s, 'ph1'), 'ph')}</td>
                <td>${renderCell(getAvg(s, 'flocP'), 'ph')}</td>
                <td>${renderCell(getAvg(s, 'ph2'), 'ph')}</td>
                <td>${renderCell(getAvg(s, 'disP'), 'ph')}</td>
                
                <td>${getCum(s, 'oilQ')}</td>
                <td>${renderCell(getDay(s, 'oilQ'), 'flow_oil')}</td>
                
                <td>${getCum(s, 'indQ')}</td>
                <td>${renderCell(getDay(s, 'indQ'), 'flow_ind')}</td>
                
                <td>${getCum(s, 'domQ')}</td>
                <td>${renderCell(getDay(s, 'domQ'), 'flow_dom')}</td>
                
                <td>${getCum(s, 'disQ')}</td>
                <td>${renderCell(getDay(s, 'disQ'), 'flow_dis')}</td>
                
                <td>${getCum(s, 'recQ')}</td>
                <td>${renderCell(getDay(s, 'recQ'), 'flow_rec')}</td>
                
                <td></td><td></td><td></td><td></td>
                
                <td></td><td></td><td></td><td></td>
            </tr>`;
        }

        const html = `
            <div style="font-family:'BiauKai', 'DFKai-SB', serif; color:black; width:100%; min-width:1200px;">
                <h2 style="text-align:center; font-size:16pt; margin-bottom:5px;">尖山電廠廢(污)水操作處理及溫排水水溫紀錄表</h2>
                <div style="text-align:right; margin-bottom:5px; font-size:11pt;">日期：${targetY - 1911}年 ${targetM}月</div>
                
                <table class="report-table" style="width:100%; border-collapse: collapse; font-size:9pt; text-align:center;">
                    <thead>
                        <tr style="background-color:#f0f0f0;">
                            <th rowspan="4" style="border:1px solid black; width:30px;">日期</th>
                            <th colspan="4" style="border:1px solid black;">水位</th>
                            <th colspan="5" style="border:1px solid black;">pH值</th>
                            <th colspan="2" style="border:1px solid black;">含油事業廢水</th>
                            <th colspan="2" style="border:1px solid black;">事業廢水</th>
                            <th colspan="2" style="border:1px solid black;">生活污水</th>
                            <th colspan="2" style="border:1px solid black;">放流水</th>
                            <th colspan="2" style="border:1px solid black;">回收水</th>
                            <th rowspan="2" style="border:1px solid black;">用電量<br>(KWH)</th>
                            <th colspan="3" style="border:1px solid black;">污泥 (kg)</th>
                            <th colspan="4" style="border:1px solid black;">化學品使用 (kg/L)</th>
                        </tr>
                        <tr style="background-color:#f0f0f0;">
                            <th style="border:1px solid black;">API</th><th style="border:1px solid black;">中間</th><th style="border:1px solid black;">事業</th><th style="border:1px solid black;">生活</th>
                            <th style="border:1px solid black;">攪拌</th><th style="border:1px solid black;">一pH</th><th style="border:1px solid black;">膠羽</th><th style="border:1px solid black;">二pH</th><th style="border:1px solid black;">放流</th>
                            <th style="border:1px solid black;">累積</th><th style="border:1px solid black;">日量</th>
                            <th style="border:1px solid black;">累積</th><th style="border:1px solid black;">日量</th>
                            <th style="border:1px solid black;">累積</th><th style="border:1px solid black;">日量</th>
                            <th style="border:1px solid black;">累積</th><th style="border:1px solid black;">日量</th>
                            <th style="border:1px solid black;">累積</th><th style="border:1px solid black;">日量</th>
                            
                            <th style="border:1px solid black;">產生</th><th style="border:1px solid black;">貯存</th><th style="border:1px solid black;">清運</th>
                            <th style="border:1px solid black;">酸</th><th style="border:1px solid black;">鹼</th><th style="border:1px solid black;">PAC</th><th style="border:1px solid black;">高分</th>
                        </tr>
                        <tr style="font-size:0.8em; background-color:#ddd;">
                            <th style="border:1px solid black;">M</th><th style="border:1px solid black;">M</th><th style="border:1px solid black;">M</th><th style="border:1px solid black;">M</th>
                            <th style="border:1px solid black;">-</th><th style="border:1px solid black;">-</th><th style="border:1px solid black;">-</th><th style="border:1px solid black;">-</th><th style="border:1px solid black;">-</th>
                            <th style="border:1px solid black;">M³</th><th style="border:1px solid black;">M³</th>
                            <th style="border:1px solid black;">M³</th><th style="border:1px solid black;">M³</th>
                            <th style="border:1px solid black;">M³</th><th style="border:1px solid black;">M³</th>
                            <th style="border:1px solid black;">M³</th><th style="border:1px solid black;">M³</th>
                            <th style="border:1px solid black;">M³</th><th style="border:1px solid black;">M³</th>
                            <th style="border:1px solid black;">-</th>
                            <th style="border:1px solid black;">kg</th><th style="border:1px solid black;">kg</th><th style="border:1px solid black;">kg</th>
                            <th style="border:1px solid black;">kg</th><th style="border:1px solid black;">kg</th><th style="border:1px solid black;">kg</th><th style="border:1px solid black;">kg</th>
                        </tr>
                        <tr style="font-size:0.8em; background-color:#ddd; color:#d32f2f; font-weight:bold;">
                            <th style="border:1px solid black;">&lt;1.4</th><th style="border:1px solid black;">&lt;0.95</th><th style="border:1px solid black;">&lt;2.1</th><th style="border:1px solid black;">&lt;4.0</th>
                            <th style="border:1px solid black;">6~9</th><th style="border:1px solid black;">6~9</th><th style="border:1px solid black;">6~9</th><th style="border:1px solid black;">6~9</th><th style="border:1px solid black;">6~9</th>
                            <th style="border:1px solid black;"></th><th style="border:1px solid black;">&lt;20</th>
                            <th style="border:1px solid black;"></th><th style="border:1px solid black;">&lt;24</th>
                            <th style="border:1px solid black;"></th><th style="border:1px solid black;">&lt;16</th>
                            <th style="border:1px solid black;"></th><th style="border:1px solid black;">&lt;40</th>
                            <th style="border:1px solid black;"></th><th style="border:1px solid black;">&lt;40</th>
                            <th style="border:1px solid black;"></th>
                            <th style="border:1px solid black;"></th><th style="border:1px solid black;"></th><th style="border:1px solid black;"></th>
                            <th style="border:1px solid black;"></th><th style="border:1px solid black;"></th><th style="border:1px solid black;"></th><th style="border:1px solid black;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                
                <div class="report-footer" style="margin-top:15px; display:flex; justify-content:space-between; padding:0 50px;">
                    <div>紀錄：　　　　　　　　經辦：　　　　　　　　課長：</div>
                    <div></div>
                    <div></div>
                </div>
                <div style="text-align:center; font-size:9pt; margin-top:5px;">表格：CS-WI-CX-22-F3，版次：5</div>
            </div>
        `;

        document.getElementById('opReportPreview').innerHTML = html;

    }).catch(e => {
        console.error(e);
        document.getElementById('opReportPreview').innerHTML = `<div style="text-align:center; color:red; padding:20px;">讀取失敗，請確認網路或資料庫</div>`;
    });
}

/**
 * 匯出 Excel
 */
function exportOpExcel() {
    const div = document.getElementById('opReportPreview');
    if (!div || div.innerText.includes("請選擇")) return alert("請先生成報表");
    
    const monthStr = document.getElementById('opReportMonth').value;
    const filename = `操作紀錄表_${monthStr}.xls`;
    
    const template = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:x="urn:schemas-microsoft-com:office:excel" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="UTF-8">
            <style>
                table { border-collapse: collapse; font-family: 'Times New Roman', 'BiauKai', serif; }
                th, td { border: 0.5pt solid black; text-align: center; vertical-align: middle; }
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

/**
 * 列印 / 轉 PDF
 */
function printOpReport() {
    const content = document.getElementById('opReportPreview').innerHTML;
    const printWindow = window.open('', '', 'height=800,width=1200');
    
    printWindow.document.write(`
        <html>
        <head>
            <title>列印操作紀錄表</title>
            <style>
                body { font-family: "BiauKai", "DFKai-SB", serif; margin: 10px; }
                table { width: 100%; border-collapse: collapse; font-size: 8pt; }
                th, td { border: 1px solid black; padding: 2px; text-align: center; vertical-align: middle; }
                th { background-color: #f0f0f0; }
                .report-footer { display: flex; justify-content: space-between; margin-top: 20px; padding: 0 50px; }
                @media print {
                    @page { size: A4 landscape; margin: 1cm; } 
                    body { -webkit-print-color-adjust: exact; }
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

// 點擊視窗外部關閉
const originalOnclickOp = window.onclick;
window.onclick = function(event) {
    if (typeof originalOnclickOp === 'function') originalOnclickOp(event);
    if (event.target == document.getElementById('opReportModal')) closeOpReport();
}
