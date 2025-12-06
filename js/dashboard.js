//(負責主畫面卡片渲染)
function initDashboard() {
    if(localStorage.getItem('theme') === 'dark') document.body.setAttribute('data-theme', 'dark');
    document.getElementById('themeBtn').innerText = localStorage.getItem('theme') === 'dark' ? "☀️" : "🌓";
    
    // 初始化日期
    document.getElementById('waterReportMonth').value = new Date().toISOString().slice(0, 7);

    // 啟動
    setInterval(fetchData, 5000);
    fetchData();
}

function fetchData() {
    fetch(API_URL + "?mode=read&t=" + new Date().getTime())
        .then(response => response.json())
        .then(data => {
            if(data.timestamp) document.getElementById('last-update').innerText = data.timestamp.split(' ')[1];
            
            let htmlContent = '';
            DASHBOARD_CONFIG.forEach(group => { 
                htmlContent += `<div class="system-group ${group.className}"><div class="system-title">${group.title} <span>${group.items.length}</span></div><div class="inner-grid">`; 
                group.items.forEach(item => { 
                    if (group.id === "acc") {
                        let today = data[item.col + "_DAILY"] || "--";
                        let yesterday = data[item.col + "_YESTERDAY"] || "--";
                        let displayVal = `${today} / <span style="font-size:0.8em; color:var(--text-sub);">${yesterday}</span>`;
                        let statusClass = checkAlarm(item.col + "_DAILY", today);
                        let gaugeHTML = getGaugeHTML(item.col + "_DAILY", today);
                        htmlContent += `<div class="card ${statusClass}"><div class="card-header"><span class="tag-name">${item.name}</span><span class="tag-id">${item.tag}</span></div><div class="data-row"><span class="value">${displayVal}</span><span class="unit">${item.unit}</span></div>${gaugeHTML}</div>`;
                    } else {
                        let val = data[item.col] !== undefined ? data[item.col] : '--'; 
                        val = applyDisplayLimit(item.col, val);
                        if (!isNaN(val) && val.toString().indexOf('.') !== -1) { val = parseFloat(val).toFixed(1); if(val.endsWith('.0')) val = val.replace('.0', ''); } 
                        let statusClass = checkAlarm(item.col, val); 
                        let gaugeHTML = getGaugeHTML(item.col, val); 
                        htmlContent += `<div class="card ${statusClass}"><div class="card-header"><span class="tag-name">${item.name}</span><span class="tag-id">${item.tag}</span></div><div class="data-row"><span class="value">${val}</span><span class="unit">${item.unit}</span></div>${gaugeHTML}</div>`; 
                    }
                }); 
                htmlContent += `</div></div>`; 
            }); 
            document.getElementById('app').innerHTML = htmlContent;
        })
        .catch(err => console.error(err));
}

function toggleTheme() {
    const body = document.body;
    const newTheme = body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    body.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    document.getElementById("themeBtn").innerHTML = newTheme === "dark" ? "☀️" : "🌓";
    if(typeof updateChart === "function" && myChart) updateChart(); // 通知圖表更新顏色
}

// ... 把 applyDisplayLimit, checkAlarm, getGaugeHTML 等輔助函式也搬過來 ...
    function applyDisplayLimit(colName, value) {
        let val = parseFloat(value); if (isNaN(val)) return value;
        if (colName === "SS018_VAL0" && val > 27) return 27;
        if (colName === "COD018_VAL0" && val > 90) return 90;
        if (colName === "OFD018_VAL0" && val > 10) return 9;
        return value;
    }

    function checkAlarm(colName, value) {
        let val = parseFloat(value); if (isNaN(val)) return "";
        if (colName.indexOf("PHI") !== -1) { if (val < 6 || val > 9) return "status-critical"; if (val < 6.5 || val > 8.5) return "status-warning"; return ""; }
        const rule = ALARMS[colName];
        if (rule) {
            let isLowAlarm = rule.warn > rule.crit;
            if (isLowAlarm) { if (val <= rule.crit) return "status-critical"; if (val <= rule.warn) return "status-warning"; }
            else { if (val >= rule.crit) return "status-critical"; if (val >= rule.warn) return "status-warning"; }
        }
        if (DASHBOARD_CONFIG.some(g => g.items.some(i => i.col === colName && i.unit === "M3/Hr"))) {
            if (val > 0) { if (!rule || (val < rule.warn)) return "status-running"; }
        }
        return "";
    }

    function getGaugeHTML(colName, value) {
        let val = parseFloat(value); if (isNaN(val)) return "";
        let rule = ALARMS[colName];
        if (colName.indexOf("PHI") !== -1) {
            let pct = (val / 14) * 100;
            let colorVar = "var(--gauge-good)";
            if (val < 6 || val > 9) colorVar = "var(--gauge-bad)"; else if (val < 6.5 || val > 8.5) colorVar = "var(--gauge-warn)";
            return `<div class="gauge-container"><div style="width: ${pct}%; background-color: ${colorVar}; height:100%; border-radius:3px;"></div><div class="gauge-marker" style="left: ${pct}%"></div></div>`;
        }
        if (rule && rule.max) {
            let max = rule.max;
            let valPct = Math.min((val / max) * 100, 100);
            let isLowAlarm = rule.warn > rule.crit;
            if (isLowAlarm) {
                let critPct = (rule.crit / max) * 100; let warnPct = (rule.warn / max) * 100;
                return `<div class="gauge-container"><div class="gauge-seg seg-rev-poor" style="width: ${critPct}%"></div><div class="gauge-seg seg-rev-warn" style="width: ${warnPct - critPct}%"></div><div class="gauge-seg seg-rev-good" style="width: ${100 - warnPct}%"></div><div class="gauge-marker" style="left: ${valPct}%"></div></div>`;
            } else {
                let warnPct = (rule.warn / max) * 100; let critPct = (rule.crit / max) * 100;
                return `<div class="gauge-container"><div class="gauge-seg seg-good" style="width: ${warnPct}%"></div><div class="gauge-seg seg-warn" style="width: ${critPct - warnPct}%"></div><div class="gauge-seg seg-poor" style="width: ${100 - critPct}%"></div><div class="gauge-marker" style="left: ${valPct}%"></div></div>`;
            }
        }
        return "";
    }
