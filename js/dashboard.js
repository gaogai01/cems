//廢水處理index.html的負責主畫面卡片渲染
// js/dashboard.js

let lastSuccessfulUpdateText = null;

/**
 * 初始化儀表板
 * 1. 設定主題
 * 2. 設定報表日期預設值
 * 3. 啟動定時更新 (每 10 秒)
 */
function initDashboard() {
    // 載入儲存的主題設定
    if(localStorage.getItem('theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        document.getElementById('themeBtn').innerText = "☀️";
    } else {
        document.getElementById('themeBtn').innerText = "🌓";
    }

    // 設定報表預設月份 (當前月份)
    const reportInput = document.getElementById('waterReportMonth');
    if(reportInput) {
         reportInput.value = getLocalYearMonth();
    }

    // 立即抓取一次，並設定排程
    fetchData();
    setInterval(fetchData, 10000); // 每 10 秒更新一次
}

function startApp() {
    if(localStorage.getItem('theme') === 'dark') document.body.setAttribute('data-theme', 'dark');
    document.getElementById('themeBtn').innerText = localStorage.getItem('theme') === 'dark' ? "☀️" : "🌓";
    
    // 初始化日期預設為當月
    document.getElementById('waterReportMonth').value = getLocalYearMonth();

    setInterval(fetchData, 5000);
    fetchData();
}

/**
 * 從後端 API 抓取即時數據
 */
function fetchData() {
    // 加上 timestamp 防止快取
    fetch(API_URL + "?mode=read&t=" + new Date().getTime())
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            // 保留最後一次成功更新時間，供連線失敗時辨識資料新鮮度
            if(data.timestamp) {
                const timestampText = String(data.timestamp).trim();
                const timeMatch = timestampText.match(/(?:T|\\s)(\\d{2}:\\d{2}(?::\\d{2})?)/);
                lastSuccessfulUpdateText = timeMatch ? timeMatch[1] : timestampText;
                document.getElementById('last-update').innerText = lastSuccessfulUpdateText;
            }

            // 產生 HTML 內容
            let htmlContent = '';
            
            // 遍歷設定檔中的每個群組 (DASHBOARD_CONFIG 來自 config.js)
            DASHBOARD_CONFIG.forEach(group => {
                htmlContent += `
                <div class="system-group ${group.className}">
                    <div class="system-title">${group.title} <span>${group.items.length}</span></div>
                    <div class="inner-grid">`;

                // 遍歷群組內的每個卡片
                group.items.forEach(item => {
                    // --- 特殊處理：ACC 流量 (顯示 今日 / 昨日) ---
                    if (group.id === "acc") {
                        const todayRaw = data[item.col + "_DAILY"];
                        const yesterdayRaw = data[item.col + "_YESTERDAY"];
                        let today = todayRaw !== undefined && todayRaw !== null && todayRaw !== "" ? todayRaw : "--";
                        let yesterday = yesterdayRaw !== undefined && yesterdayRaw !== null && yesterdayRaw !== "" ? yesterdayRaw : "--";
                        
                        // 組合顯示字串
                        let displayVal = `${today} / <span style="font-size:0.8em; color:var(--text-sub);">${yesterday}</span>`;

                        // 使用今日流量來判斷警報狀態
                        let statusClass = checkAlarm(item.col + "_DAILY", today);
                        let gaugeHTML = getGaugeHTML(item.col + "_DAILY", today);

                        htmlContent += generateCardHTML(statusClass, item.name, item.tag, displayVal, item.unit, gaugeHTML);
                    } 
                    // --- 一般數值處理 ---
                    else {
                        const rawVal = data[item.col] !== undefined && data[item.col] !== null ? data[item.col] : '--';
                        let displayVal = rawVal;

                        // 顯示值可四捨五入，但警報與儀表一律使用原始讀值
                        const numericVal = Number(rawVal);
                        if (rawVal !== '--' && Number.isFinite(numericVal) && String(rawVal).includes('.')) {
                            displayVal = numericVal.toFixed(1);
                            if(displayVal.endsWith('.0')) displayVal = displayVal.replace('.0', '');
                        }

                        let statusClass = checkAlarm(item.col, rawVal);
                        let gaugeHTML = getGaugeHTML(item.col, rawVal);

                        htmlContent += generateCardHTML(statusClass, item.name, item.tag, displayVal, item.unit, gaugeHTML);
                    }
                });
                htmlContent += `</div></div>`;
            });

            // 將生成的 HTML 注入到頁面
            document.getElementById('app').innerHTML = htmlContent;
        })
        .catch(err => {
            console.error("Fetch error:", err);
            const lastUpdateLabel = document.getElementById('last-update');
            lastUpdateLabel.innerText = lastSuccessfulUpdateText
                ? `連線異常｜最後成功更新：${lastSuccessfulUpdateText}（畫面可能已過期）`
                : "連線異常｜尚無成功資料";
        });
}

/**
 * 產生單張卡片的 HTML 結構
 */
function generateCardHTML(statusClass, name, tag, valueDisplay, unit, gaugeHTML) {
    return `
    <div class="card ${statusClass}">
        <div class="card-header">
            <span class="tag-name">${name}</span>
            <span class="tag-id">${tag}</span>
        </div>
        <div class="data-row">
            <span class="value">${valueDisplay}</span>
            <span class="unit">${unit}</span>
        </div>
        ${gaugeHTML}
    </div>`;
}

/**
 * 檢查警報狀態，回傳對應的 CSS class
 * (status-critical, status-warning, status-running, 或空字串)
 */
function checkAlarm(colName, value) {
    let val = parseFloat(value);
    if (isNaN(val)) return "";

    // pH值 特殊判斷 (雙向警報: <6 或 >9)
    if (colName.indexOf("PHI") !== -1) {
        if (val < 6 || val > 9) return "status-critical";
        if (val < 6.5 || val > 8.5) return "status-warning";
        return "";
    }

    // 一般數值判斷 (ALARMS 來自 config.js)
    const rule = ALARMS[colName];
    if (rule) {
        let isLowAlarm = rule.warn > rule.crit; // 判斷是低液位警報還是高液位警報
        
        if (isLowAlarm) { // 低液位警報 (越低越危險)
            if (val <= rule.crit) return "status-critical";
            if (val <= rule.warn) return "status-warning";
        } else { // 高液位/數值警報 (越高越危險)
            if (val >= rule.crit) return "status-critical";
            if (val >= rule.warn) return "status-warning";
        }
    }

    // 運轉狀態判斷 (如果是流量計且有數值，顯示綠色運轉燈)
    // 這裡需要遍歷設定檔來確認單位是否為 M3/Hr
    const isFlow = DASHBOARD_CONFIG.some(g => g.items.some(i => i.col === colName && i.unit === "M3/Hr"));
    if (isFlow) {
        if (val > 0) {
            // 如果沒有設警報，或者數值未達警告值，則顯示運轉中
            if (!rule || (val < rule.warn)) return "status-running";
        }
    }

    return "";
}

/**
 * 產生儀表條 (Gauge Bar) 的 HTML
 */
function getGaugeHTML(colName, value) {
    let val = parseFloat(value);
    if (isNaN(val)) return "";

    let rule = ALARMS[colName];

    // pH值 儀表條
    if (colName.indexOf("PHI") !== -1) {
        let pct = (val / 14) * 100; // pH 0-14
        let colorVar = "var(--gauge-good)";
        if (val < 6 || val > 9) colorVar = "var(--gauge-bad)";
        else if (val < 6.5 || val > 8.5) colorVar = "var(--gauge-warn)";
        
        return `<div class="gauge-container">
                    <div style="width: ${pct}%; background-color: ${colorVar}; height:100%; border-radius:3px;"></div>
                    <div class="gauge-marker" style="left: ${pct}%"></div>
                </div>`;
    }

    // 一般數值 儀表條
    if (rule && rule.max) {
        let max = rule.max;
        let valPct = Math.min((val / max) * 100, 100); // 限制最大 100%
        let isLowAlarm = rule.warn > rule.crit;
        
        // 計算各區段比例
        let critPct = (rule.crit / max) * 100;
        let warnPct = (rule.warn / max) * 100;

        if (isLowAlarm) {
             // 低液位警報條 (左邊紅 -> 黃 -> 綠)
             return `<div class="gauge-container">
                <div class="gauge-seg seg-rev-poor" style="width: ${critPct}%"></div>
                <div class="gauge-seg seg-rev-warn" style="width: ${warnPct - critPct}%"></div>
                <div class="gauge-seg seg-rev-good" style="width: ${100 - warnPct}%"></div>
                <div class="gauge-marker" style="left: ${valPct}%"></div>
             </div>`;
        } else {
             // 高數值警報條 (左邊綠 -> 黃 -> 紅)
             return `<div class="gauge-container">
                <div class="gauge-seg seg-good" style="width: ${warnPct}%"></div>
                <div class="gauge-seg seg-warn" style="width: ${critPct - warnPct}%"></div>
                <div class="gauge-seg seg-poor" style="width: ${100 - critPct}%"></div>
                <div class="gauge-marker" style="left: ${valPct}%"></div>
             </div>`;
        }
    }
    return "";
}

/**
 * 切換明亮/深色模式
 */
function toggleTheme() {
    const body = document.body;
    const newTheme = body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    body.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    document.getElementById("themeBtn").innerText = newTheme === "dark" ? "☀️" : "🌓";
    
    // 如果圖表已經初始化，通知圖表更新顏色 (如果 charts.js 已載入)
    if (typeof updateChart === "function" && typeof myChart !== 'undefined' && myChart) {
         // 這裡需要 charts.js 裡的 updateChart 支援重繪，或者簡單觸發
         const isDark = newTheme === "dark";
         const gridColor = isDark ? '#444' : '#ddd';
         const textColor = isDark ? '#eee' : '#666';
         
         myChart.options.scales.x.grid.color = gridColor;
         myChart.options.scales.y.grid.color = gridColor;
         myChart.options.scales.x.ticks.color = textColor;
         myChart.options.scales.y.ticks.color = textColor;
         myChart.options.plugins.legend.labels.color = textColor;
         myChart.update();
    }
}
