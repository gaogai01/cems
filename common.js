// ============================================================
// 1. Firebase 設定 (請填入您的設定，所有網頁共用這裡)
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyA58DOYplXhmo7HDYN_2Hgu-wo4ceYmINA",
  authDomain: "tpc-monitor.firebaseapp.com",
  projectId: "tpc-monitor",
  storageBucket: "tpc-monitor.firebasestorage.app",
  messagingSenderId: "1066125366380",
  appId: "1:1066125366380:web:836d5898c051226669f449"
};

// 初始化 Firebase (防止重複初始化)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================================
// 2. 自動產生導航列 (Navbar)
// ============================================================
document.addEventListener("DOMContentLoaded", function() {
    const navPlaceholder = document.getElementById("navbar-placeholder");
    if (navPlaceholder) {
        // 定義選單項目 (如果要新增網頁，加在這裡即可)
        const menuItems = [
            { name: "廢水處理", link: "index.html" },
            { name: "CEMS監測", link: "cems.html" },
            { name: "尿素分析", link: "urea.html" },
            { name: "滑油報告", link: "oil.html" }
        ];

        // 判斷當前頁面，設定 active 樣式
        const currentPage = window.location.pathname.split("/").pop() || "index.html";

        let menuHtml = "";
        menuItems.forEach(item => {
            const isActive = (item.link === currentPage) ? "active" : "";
            menuHtml += `<a href="${item.link}" class="nav-link ${isActive}">${item.name}</a>`;
        });

        // 注入 HTML (包含 CSS 樣式)
        navPlaceholder.innerHTML = `
            <style>
                /* 統一的導航列樣式 (參考廢油水設計) */
                .navbar { 
                    background: #333; 
                    padding: 10px 20px; 
                    display: flex; 
                    align-items: center; 
                    gap: 15px; 
                    margin-bottom: 20px; 
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2); 
                    flex-wrap: wrap;
                }
                .nav-link { 
                    color: #ccc; 
                    text-decoration: none; 
                    font-size: 1rem; 
                    padding: 8px 12px; 
                    border-radius: 5px; 
                    transition: 0.2s; 
                    font-family: "Microsoft JhengHei", sans-serif;
                }
                .nav-link:hover { 
                    background: #555; 
                    color: white; 
                }
                .nav-link.active { 
                    background: #007bff; /* 廢油水的主色 */
                    color: white; 
                    font-weight: bold; 
                }
                /* CEMS頁面特殊色 (可選) */
                /* body:has(title:contains("CEMS")) .nav-link.active { background: #28a745; } */

                .user-info { 
                    margin-left: auto; 
                    color: white; 
                    font-size: 0.9rem; 
                    display: flex; 
                    align-items: center; 
                    gap: 10px; 
                    font-family: "Microsoft JhengHei", sans-serif;
                }
                .btn-logout { 
                    background: transparent; 
                    border: 1px solid #777; 
                    color: #f8d7da; 
                    cursor: pointer; 
                    padding: 3px 10px; 
                    border-radius: 4px; 
                    font-size: 0.85rem; 
                }
                .btn-logout:hover { 
                    background: #c82333; 
                    border-color: #bd2130; 
                    color: white; 
                }
                
                @media (max-width: 768px) {
                    .navbar { gap: 5px; padding: 8px; }
                    .nav-link { font-size: 0.85rem; padding: 6px 8px; flex: 1; text-align: center; white-space: nowrap; }
                    .user-info { width: 100%; justify-content: flex-end; margin-top: 5px; }
                }
            </style>
            <div class="navbar">
                ${menuHtml}
                <div class="user-info">
                    <span id="user-name">驗證中...</span> | 
                    <button class="btn-logout" onclick="logout()">登出</button>
                </div>
            </div>
        `;
    }
});

// ============================================================
// 3. 權限驗證邏輯 (所有頁面通用)
// ============================================================
auth.onAuthStateChanged(async (user) => {
    // 如果是在 login.html 就不執行跳轉
    if (window.location.pathname.includes("login.html")) return;

    if (!user) {
        location.href = 'login.html';
    } else {
        // 檢查 Firestore 使用者資料
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (!doc.exists || !doc.data().isApproved) {
                alert("您的帳號尚未核准，請聯繫管理員。");
                location.href = 'login.html';
            } else {
                // 驗證通過，顯示名字
                const userNameDisplay = document.getElementById('user-name');
                if (userNameDisplay) {
                    userNameDisplay.innerText = doc.data().name;
                }
                // 如果頁面有定義 startApp() 函式，則執行它 (例如 CEMS 或 廢水 的主程式)
                if (typeof startApp === "function") {
                    startApp();
                }
            }
        } catch (e) {
            console.error("Auth Error:", e);
            // location.href = 'login.html'; // 錯誤時是否踢出可自行決定
        }
    }
});

function logout() {
    auth.signOut().then(() => location.href = 'login.html');
}
