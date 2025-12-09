// js/reports.js

// 全域變數快取
let cachedHistoryReport = null;

// ============================================================
// 1. 水質紀錄表 (generateWaterReport)
// ============================================================
function openWaterReport() { document.getElementById('waterReportModal').style.display = 'block'; }
function closeWaterReport() { document.getElementById('waterReportModal').style.display = 'none'; }

function generateWaterReport() {
    const monthStr = document.getElementById('waterReportMonth').value;
    if (!monthStr) return alert("請選擇月份");
    document.getElementById('waterReportPreview').innerHTML = "讀取歷史數據中...";

    const p = (typeof cachedHistory !== 'undefined' && cachedHistory) ? 
              Promise.resolve(cachedHistory) : 
              fetch(API_URL + "?mode=history").then(r => r.json());
    
    p.then(data => {
        if(typeof window.cachedHistory === 'undefined' || !window.cachedHistory) window.cachedHistory = data;
        
        const [targetY, targetM] = monthStr.split('-').map(Number);
        const daysInMonth = new Date(targetY, targetM, 0).getDate();
        const dayStats = {}; 

        // 初始化
        for(let i=1; i<=daysInMonth; i++) dayStats[i] = { ph:[0,0], cod:[0,0], ss:[0,0], oil:[0,0], nh3:[0,0] };

        // 索引對照
        const h = data.headers;
        const idx = {
            ph: h.indexOf("PHI018_VAL0"), cod: h.indexOf("COD018_VAL0"), 
            ss: h.indexOf("SS018_VAL0"), oil: h.indexOf("OFD018_VAL0"), nh3: h.indexOf("NH3N018_VAL0")
        };

        // 統計
        data.data.forEach(row => {
            const d = new Date(row[0].replace(/-/g, "/"));
            if (d.getFullYear() === targetY && (d.getMonth()+1) === targetM) {
                const day = d.getDate();
                const s = dayStats[day];
                for(let k in idx) {
                    let val = parseFloat(row[idx[k]]);
                    if(!isNaN(val) && val > 0) { s[k][0] += val; s[k][1]++; }
                }
            }
        });

        // 生成表格
        let rows = "";
        for(let i=1; i<=daysInMonth; i++) {
            const s = dayStats[i];
            const getAvg = (k, fix=1) => s[k][1] > 0 ? (s[k][0] / s[k][1]).toFixed(fix) : "-";
            
            // 判斷紅字 (數值, 類型)
            const phVal = getAvg('ph');
            const codVal = getAvg('cod');
            const ssVal = getAvg('ss');
            const oilVal = getAvg('oil');
            const nh3Val = getAvg('nh3');

            rows += `<tr>
                <td>${i}</td>
                <td>${checkVal(phVal, 'ph')}</td>
                <td>${checkVal(codVal, 'cod')}</td>
                <td>${checkVal(ssVal, 'ss')}</td>
                <td>${checkVal(oilVal, 'oil')}</td>
                <td>${checkVal(nh3Val, 'nh3')}</td>
                <td></td>
            </tr>`;
        }

        const html = `
            <div style="font-family:'BiauKai', 'DFKai-SB', serif; color:black;">
            <h2 style="text-align:center; font-size:18pt; margin-bottom:5px;">尖山電廠放流水水質紀錄表</h2>
            <div style="text-align:center; font-size:0.8em; margin-top:0px;">表格：CS-WI-CX-22-F2</div>
            <div style="text-align:right; margin-bottom:5px;">日期：${targetY - 1911}年 ${targetM}月</div>
            <table class="report-table" style="width:100%;">
                <thead>
                    <tr><th>日期</th><th>PH</th><th>COD</th><th>SS</th><th>OIL</th><th>氨氮</th><th>備註</th></tr>
                    <tr style="background:#eee;">
                        <th>標準</th><th>6~9</th><th><100</th><th><30</th><th><10</th><th><100</th><th></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="report-footer" style="display:flex; justify-content:flex-start; gap:150px; margin-top:20px; padding-left:20px;">
                <div>紀錄:</div><div>經辦:</div><div>課長:</div>
            </div>
            </div>
        `;
        document.getElementById('waterReportPreview').innerHTML = html;

    }).catch(e => { console.error(e); alert("讀取失敗"); });
}

// ============================================================
// 2. 操作紀錄表 (generateOpReport)
// ============================================================
function openOpReport() { 
    document.getElementById('opReportModal').style.display = 'block'; 
    if(!document.getElementById('opReportMonth').value) document.getElementById('opReportMonth').value = new Date().toISOString().slice(0, 7);
}
function closeOpReport() { document.getElementById('opReportModal').style.display = 'none'; }

function generateOpReport() {
    const monthStr = document.getElementById('opReportMonth').value;
    if (!monthStr) return alert("請選擇月份");
    document.getElementById('opReportPreview').innerHTML = "數據計算中...";

    const p = (typeof cachedHistory !== 'undefined' && cachedHistory) ? 
              Promise.resolve(cachedHistory) : 
              fetch(API_URL + "?mode=history").then(r => r.json());

    p.then(data => {
        if(typeof window.cachedHistory === 'undefined' || !window.cachedHistory) window.cachedHistory = data;
        const [targetY, targetM] = monthStr.split('-').map(Number);
        const daysInMonth = new Date(targetY, targetM, 0).getDate();
        
        // 統計容器
        const dayStats = {};
        for(let i=1; i<=daysInMonth; i++) {
            dayStats[i] = { 
                // 平均 (Sum/Count)
                apiL:{s:0,c:0}, midL:{s:0,c:0}, indL:{s:0,c:0}, domL:{s:0,c:0},
                mixP:{s:0,c:0}, ph1:{s:0,c:0}, flocP:{s:0,c:0}, ph2:{s:0,c:0}, disP:{s:0,c:0},
                ss:{s:0,c:0}, cod:{s:0,c:0}, oil:{s:0,c:0}, nh3:{s:0,c:0},
                // 流量 (Max/Min)
                oilQ:{max:-1,min:Infinity}, indQ:{max:-1,min:Infinity}, domQ:{max:-1,min:Infinity}, 
                disQ:{max:-1,min:Infinity}, recQ:{max:-1,min:Infinity}
            };
        }

        const h = data.headers;
        const idx = {
            // 水位 (cm -> m)
            apiL: h.indexOf("LIT000_VAL0"), midL: h.indexOf("LI003_VAL0"), indL: h.indexOf("LI012_VAL0"), domL: h.indexOf("LI021_VAL0"),
            // pH
            mixP: h.indexOf("PHI015_VAL0"), ph1: h.indexOf("PHI013_VAL0"), flocP: h.indexOf("PHI014_VAL0"), ph2: h.indexOf("PHI017_VAL0"), disP: h.indexOf("PHI018_VAL0"),
            // 水質
            ss: h.indexOf("SS018_VAL0"), cod: h.indexOf("COD018_VAL0"), oil: h.indexOf("OFD018_VAL0"), nh3: h.indexOf("NH3N018_VAL0"),
            // 流量
            oilQ: h.indexOf("FI000A_Q_VAL0"), indQ: h.indexOf("FI012_Q_VAL0"), domQ: h.indexOf("FI021W_Q_VAL0"), disQ: h.indexOf("FI018_Q_VAL0"), recQ: h.indexOf("FI018B_Q_VAL0")
        };

        data.data.forEach(row => {
            const d = new Date(row[0].replace(/-/g, "/"));
            if (d.getFullYear() === targetY && (d.getMonth()+1) === targetM) {
                const day = d.getDate();
                const s = dayStats[day];
                // 水位 / 100
                ['apiL', 'midL', 'indL', 'domL'].forEach(k => { let v = parseFloat(row[idx[k]]); if(!isNaN(v)) { s[k].s += (v/100); s[k].c++; } });
                // 平均
                ['mixP', 'ph1', 'flocP', 'ph2', 'disP', 'ss', 'cod', 'oil', 'nh3'].forEach(k => { let v = parseFloat(row[idx[k]]); if(!isNaN(v) && v>0) { s[k].s += v; s[k].c++; } });
                // 流量
                ['oilQ', 'indQ', 'domQ', 'disQ', 'recQ'].forEach(k => {
                    let v = parseFloat(row[idx[k]]);
                    if(!isNaN(v) && v > 0) { if(v > s[k].max) s[k].max = v; if(v < s[k].min) s[k].min = v; }
                });
            }
        });

        let rows = "";
        const getAvg = (s, k, f=1) => s[k].c > 0 ? (s[k].s / s[k].c).toFixed(f) : "-";
        const getCum = (s, k) => s[k].max > -1 ? s[k].max.toFixed(0) : "-";
        const getDay = (s, k) => (s[k].max > -1 && s[k].min !== Infinity) ? (s[k].max - s[k].min).toFixed(1) : "-";

        for(let i=1; i<=daysInMonth; i++) {
            const s = dayStats[i];
            rows += `
            <tr style="height:30px;">
                <td>${i}</td><td></td><td></td>
                <td>${checkVal(getAvg(s,'apiL',2), 'lvl_api')}</td>
                <td>${checkVal(getAvg(s,'midL',2), 'lvl_mid')}</td>
                <td>${checkVal(getAvg(s,'indL',2), 'lvl_ind')}</td>
                <td>${checkVal(getAvg(s,'domL',2), 'lvl_dom')}</td>
                <td>${checkVal(getAvg(s,'mixP'), 'ph')}</td>
                <td>${checkVal(getAvg(s,'ph1'), 'ph')}</td>
                <td>${checkVal(getAvg(s,'flocP'), 'ph')}</td>
                <td>${checkVal(getAvg(s,'ph2'), 'ph')}</td>
                <td>${checkVal(getAvg(s,'disP'), 'ph')}</td>
                <td>${checkVal(getAvg(s,'ss'), 'ss')}</td>
                <td>${checkVal(getAvg(s,'cod'), 'cod')}</td>
                <td>${checkVal(getAvg(s,'oil'), 'oil')}</td>
                <td>${checkVal(getAvg(s,'nh3'), 'nh3')}</td>
                <td>${getCum(s,'oilQ')}</td><td>${checkVal(getDay(s,'oilQ'), 'q_oil')}</td>
                <td>${getCum(s,'indQ')}</td><td>${checkVal(getDay(s,'indQ'), 'q_ind')}</td>
                <td>${getCum(s,'domQ')}</td><td>${checkVal(getDay(s,'domQ'), 'q_dom')}</td>
                <td>${getCum(s,'disQ')}</td><td>${checkVal(getDay(s,'disQ'), 'q_dis')}</td>
                <td>${getCum(s,'recQ')}</td><td>${checkVal(getDay(s,'recQ'), 'q_rec')}</td>
                <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                <td></td>
            </tr>`;
        }

        const html = `
            <div style="font-family:'BiauKai', 'DFKai-SB', serif; color:black; width:100%;">
                <h2 style="text-align:center; font-size:16pt; margin-bottom:5px;">尖山電廠廢(污)水操作處理及溫排水水溫紀錄表</h2>
                <div style="text-align:right; margin-bottom:5px; font-size:11pt;">日期：${targetY - 1911}年 ${targetM}月</div>
                <div style="overflow-x:auto;">
                <table class="report-table" style="width:100%; border-collapse: collapse; font-size:9pt; text-align:center;">
                    <thead>
                        <tr style="background-color:#f0f0f0;">
                            <th rowspan="4" style="border:1px solid black; width:30px;">日期</th>
                            <th colspan="2" style="border:1px solid black;">操作時間</th>
                            <th colspan="4" style="border:1px solid black;">水位</th>
                            <th colspan="5" style="border:1px solid black;">pH值</th>
                            <th colspan="4" style="border:1px solid black;">水質</th>
                            <th colspan="2" style="border:1px solid black;">含油事業廢水</th>
                            <th colspan="2" style="border:1px solid black;">事業廢水</th>
                            <th colspan="2" style="border:1px solid black;">生活污水</th>
                            <th colspan="2" style="border:1px solid black;">放流水</th>
                            <th colspan="2" style="border:1px solid black;">回收水</th>
                            <th rowspan="2" style="border:1px solid black;">用電量<br>(KWH)</th>
                            <th colspan="3" style="border:1px solid black;">污泥 (kg)</th>
                            <th colspan="4" style="border:1px solid black;">化學品使用 (kg/L)</th>
                            <th colspan="3" style="border:1px solid black;">溫排水水溫(℃)</th>
                            <th rowspan="4" style="border:1px solid black; width:50px;">值班<br>人員</th>
                        </tr>
                        <tr style="background-color:#f0f0f0;">
                            <th style="border:1px solid black;">起</th><th style="border:1px solid black;">迄</th>
                            <th style="border:1px solid black;">API</th><th style="border:1px solid black;">中間</th><th style="border:1px solid black;">事業</th><th style="border:1px solid black;">生活</th>
                            <th style="border:1px solid black;">攪拌</th><th style="border:1px solid black;">一pH</th><th style="border:1px solid black;">膠羽</th><th style="border:1px solid black;">二pH</th><th style="border:1px solid black;">放流</th>
                            <th style="border:1px solid black;">SS</th><th style="border:1px solid black;">COD</th><th style="border:1px solid black;">油</th><th style="border:1px solid black;">氨氮</th>
                            <th style="border:1px solid black;">累積</th><th style="border:1px solid black;">日量</th>
                            <th style="border:1px solid black;">累積</th><th style="border:1px solid black;">日量</th>
                            <th style="border:1px solid black;">累積</th><th style="border:1px solid black;">日量</th>
                            <th style="border:1px solid black;">累積</th><th style="border:1px solid black;">日量</th>
                            <th style="border:1px solid black;">累積</th><th style="border:1px solid black;">日量</th>
                            <th style="border:1px solid black;">產生</th><th style="border:1px solid black;">貯存</th><th style="border:1px solid black;">清運</th>
                            <th style="border:1px solid black;">酸</th><th style="border:1px solid black;">鹼</th><th style="border:1px solid black;">PAC</th><th style="border:1px solid black;">高分</th>
                            <th style="border:1px solid black;">進水</th><th style="border:1px solid black;">出水</th><th style="border:1px solid black;">溫差</th>
                        </tr>
                        <tr style="font-size:0.8em; background-color:#ddd;">
                            <th style="border:1px solid black;">M</th><th style="border:1px solid black;">M</th><th style="border:1px solid black;">M</th><th style="border:1px solid black;">M</th>
                            <th style="border:1px solid black;">-</th><th style="border:1px solid black;">-</th><th style="border:1px solid black;">-</th><th style="border:1px solid black;">-</th><th style="border:1px solid black;">-</th>
                            <th style="border:1px solid black;">mg/L</th><th style="border:1px solid black;">mg/L</th><th style="border:1px solid black;">mg/L</th><th style="border:1px solid black;">mg/L</th>
                            <th style="border:1px solid black;">M³</th><th style="border:1px solid black;">M³</th>
                            <th style="border:1px solid black;">M³</th><th style="border:1px solid black;">M³</th>
                            <th style="border:1px solid black;">M³</th><th style="border:1px solid black;">M³</th>
                            <th style="border:1px solid black;">M³</th><th style="border:1px solid black;">M³</th>
                            <th style="border:1px solid black;">M³</th><th style="border:1px solid black;">M³</th>
                            <th style="border:1px solid black;">-</th>
                            <th style="border:1px solid black;">kg</th><th style="border:1px solid black;">kg</th><th style="border:1px solid black;">kg</th>
                            <th style="border:1px solid black;">kg</th><th style="border:1px solid black;">kg</th><th style="border:1px solid black;">kg</th><th style="border:1px solid black;">kg</th>
                            <th style="border:1px solid black;">℃</th><th style="border:1px solid black;">℃</th><th style="border:1px solid black;">℃</th>
                        </tr>
                        <tr style="font-size:0.8em; background-color:#ddd; color:#d32f2f; font-weight:bold;">
                            <th style="border:1px solid black;">&lt;1.4</th><th style="border:1px solid black;">&lt;0.95</th><th style="border:1px solid black;">&lt;2.1</th><th style="border:1px solid black;">&lt;4.0</th>
                            <th style="border:1px solid black;">6~9</th><th style="border:1px solid black;">6~9</th><th style="border:1px solid black;">6~9</th><th style="border:1px solid black;">6~9</th><th style="border:1px solid black;">6~9</th>
                            <th style="border:1px solid black;">&lt;30</th><th style="border:1px solid black;">&lt;100</th><th style="border:1px solid black;">&lt;10</th><th style="border:1px solid black;">&lt;100</th>
                            <th style="border:1px solid black;"></th><th style="border:1px solid black;">&lt;20</th>
                            <th style="border:1px solid black;"></th><th style="border:1px solid black;">&lt;24</th>
                            <th style="border:1px solid black;"></th><th style="border:1px solid black;">&lt;16</th>
                            <th style="border:1px solid black;"></th><th style="border:1px solid black;">&lt;40</th>
                            <th style="border:1px solid black;"></th><th style="border:1px solid black;">&lt;40</th>
                            <th style="border:1px solid black;"></th>
                            <th style="border:1px solid black;"></th><th style="border:1px solid black;"></th><th style="border:1px solid black;"></th>
                            <th style="border:1px solid black;"></th><th style="border:1px solid black;"></th><th style="border:1px solid black;"></th><th style="border:1px solid black;"></th>
                            <th style="border:1px solid black;">&lt;40</th><th style="border:1px solid black;">&lt;42</th><th style="border:1px solid black;">&lt;4</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <div class="report-footer" style="display:flex; justify-content:flex-start; gap:150px; margin-top:20px; padding-left:20px;">
                    <div>紀錄：</div>
                    <div>經辦：</div>
                    <div>課長：</div>
                </div>
                <div style="text-align:right; font-size:9pt; margin-top:5px;">表格：CS-WI-CX-22-F3</div>
            </div>
        `;
        document.getElementById('opReportPreview').innerHTML = html;

    }).catch(e => { console.error(e); alert("讀取失敗"); });
}

// ------------------------------------------------------------
// 3. 輔助功能：紅字檢查函式
// ------------------------------------------------------------
function checkVal(val, type) {
    if (val === "-" || val === "") return "-";
    const num = parseFloat(val);
    let isRed = false;

    // 標準對照
    if (type === 'ph') { if (num < 6 || num > 9) isRed = true; }
    else if (type === 'ss') { if (num >= 30) isRed = true; }
    else if (type === 'cod') { if (num >= 100) isRed = true; }
    else if (type === 'oil') { if (num >= 10) isRed = true; }
    else if (type === 'nh3') { if (num >= 100) isRed = true; }
    
    // 水位 (m)
    else if (type === 'lvl_api') { if (num >= 1.4) isRed = true; }
    else if (type === 'lvl_mid') { if (num >= 0.95) isRed = true; }
    else if (type === 'lvl_ind') { if (num >= 2.1) isRed = true; }
    else if (type === 'lvl_dom') { if (num >= 4.0) isRed = true; }
    
    // 流量 (日量)
    else if (type === 'q_oil') { if (num >= 20) isRed = true; }
    else if (type === 'q_ind') { if (num >= 24) isRed = true; }
    else if (type === 'q_dom') { if (num >= 16) isRed = true; }
    else if (type === 'q_dis') { if (num >= 40) isRed = true; }
    else if (type === 'q_rec') { if (num >= 40) isRed = true; }

    return isRed ? `<span style="color:red; font-weight:bold;">${val}</span>` : val;
}

// ------------------------------------------------------------
// 4. 匯出功能 (共用)
// ------------------------------------------------------------
function exportWaterExcel() { _exportExcel('waterReportPreview', '水質紀錄表'); }
function exportOpExcel() { _exportExcel('opReportPreview', '操作紀錄表'); }

function _exportExcel(elemId, prefix) {
    const div = document.getElementById(elemId);
    if (!div || div.innerText.includes("請選擇")) return alert("請先生成報表");
    const month = document.getElementById(elemId === 'waterReportPreview' ? 'waterReportMonth' : 'opReportMonth').value;
    const filename = `${prefix}_${month}.xls`;
    const template = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>table{border-collapse:collapse;}th,td{border:0.5pt solid black;text-align:center;mso-number-format:"\@";}</style></head><body>${div.innerHTML}</body></html>`;
    const blob = new Blob([template], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function printWaterReport() { _printReport('waterReportPreview', false); }
function printOpReport() { _printReport('opReportPreview', true); }

function _printReport(elemId, landscape) {
    const content = document.getElementById(elemId).innerHTML;
    const win = window.open('', '', 'height=800,width=1200');
    win.document.write(`<html><head><title>列印</title><style>body{font-family:"BiauKai";margin:20px;} table{width:100%;border-collapse:collapse;font-size:9pt;} th,td{border:1px solid black;padding:2px;text-align:center;} th{background:#f0f0f0;} @media print{@page{size:${landscape?'landscape':'portrait'};margin:1cm;}}</style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
}

// 點擊關閉
window.onclick = function(event) {
    if (event.target == document.getElementById('waterReportModal')) closeWaterReport();
    if (event.target == document.getElementById('opReportModal')) closeOpReport();
    if (event.target == document.getElementById('chartModal') && typeof closeChartModal === 'function') closeChartModal();
}
