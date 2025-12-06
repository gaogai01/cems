//(負責水質紀錄表)
let cachedHistoryReport = null; // 避免變數名稱衝突

function openWaterReport() { document.getElementById('waterReportModal').style.display = 'block'; }
function closeWaterReport() { document.getElementById('waterReportModal').style.display = 'none'; }

    function generateWaterReport() {
        const monthStr = document.getElementById('waterReportMonth').value;
        if (!monthStr) return alert("請選擇月份");
        document.getElementById('waterReportPreview').innerHTML = "讀取歷史數據中...";

        const p = cachedHistory ? Promise.resolve(cachedHistory) : fetch(API_URL + "?mode=history").then(r=>r.json());
        
        p.then(data => {
            cachedHistory = data;
            const [targetY, targetM] = monthStr.split('-').map(Number);
            const daysInMonth = new Date(targetY, targetM, 0).getDate();
            // 增加 nh3 (氨氮)
            const dayStats = {}; 
            for(let i=1; i<=daysInMonth; i++) dayStats[i] = { ph:[0,0], cod:[0,0], ss:[0,0], oil:[0,0], nh3:[0,0] };

            data.data.forEach(row => {
                const d = new Date(row[0]);
                if (d.getFullYear() === targetY && (d.getMonth()+1) === targetM) {
                    const day = d.getDate();
                    const phIdx = data.headers.indexOf("PHI018_VAL0");
                    const codIdx = data.headers.indexOf("COD018_VAL0");
                    const ssIdx = data.headers.indexOf("SS018_VAL0");
                    const oilIdx = data.headers.indexOf("OFD018_VAL0");
                    const nh3Idx = data.headers.indexOf("NH3N018_VAL0"); // 新增

                    const addStat = (key, idx) => {
                        let val = parseFloat(row[idx]);
                        if (!isNaN(val) && val > 0) { dayStats[day][key][0] += val; dayStats[day][key][1]++; }
                    };
                    addStat('ph', phIdx); addStat('cod', codIdx); addStat('ss', ssIdx); addStat('oil', oilIdx); addStat('nh3', nh3Idx);
                }
            });

            let rows = "";
            for(let i=1; i<=daysInMonth; i++) {
                const s = dayStats[i];
                const getAvg = (key) => s[key][1] > 0 ? (s[key][0] / s[key][1]).toFixed(1) : "-";
                // 增加一欄顯示氨氮
                rows += `<tr><td>${i}</td><td>${getAvg('ph')}</td><td>${getAvg('cod')}</td><td>${getAvg('ss')}</td><td>${getAvg('oil')}</td><td>${getAvg('nh3')}</td><td></td></tr>`;
            }

            const html = `
                <div style="font-family:BiauKai;">
                <h2 style="text-align:center; font-size:18pt; margin-bottom:5px;">尖山電廠放流水水質紀錄表</h2>
                
                <div style="text-align:right; margin-bottom:5px;">日期：${targetY - 1911}年 ${targetM}月</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>日期</th><th>PH</th><th>COD</th><th>SS</th><th>OIL</th><th>氨氮</th><th>備註</th>
                        </tr>
                        <tr style="background:#eee;">
                            <th>標準</th><th>6~9</th><th><100mg/L</th><th><30 mg/L</th><th><10 mg/L</th><th><100 mg/L</th><th></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <div class="report-footer" style="display:flex; justify-content:center; gap:80px; margin-top:20px;">
                    <div>紀錄:　　　　經辦:　　　　課長:</div>
                </div>
                </div>
                <div style="text-align:center; font-size:0.8em; margin-top:0px;">表格：CS-WI-CX-22-F2</div>
            `;
            document.getElementById('waterReportPreview').innerHTML = html;

        }).catch(e => { console.error(e); alert("讀取失敗"); });
    }

    function exportWaterExcel() {
        const div = document.getElementById('waterReportPreview');
        if (!div || div.innerText === "請選擇月份並點擊更新") return alert("請先生成報表");
        const monthStr = document.getElementById('waterReportMonth').value;
        const filename = `放流水水質紀錄表_${monthStr}.xls`;
        const template = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>table{border-collapse:collapse;}th,td{border:1px solid black;text-align:center;}</style></head><body>${div.innerHTML}</body></html>`;
        const blob = new Blob([template], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    }
    
    function printWaterReport() {
        const content = document.getElementById('waterReportPreview').innerHTML;
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write('<html><head><title>列印</title><style>.report-table{width:100%;border-collapse:collapse;} .report-table th, .report-table td{border:1px solid black;padding:4px;text-align:center;} .report-footer{display:flex;justify-content:center;gap:80px;margin-top:20px;}</style></head><body>');
        printWindow.document.write(content); printWindow.document.write('</body></html>'); printWindow.document.close(); printWindow.print();
    }
