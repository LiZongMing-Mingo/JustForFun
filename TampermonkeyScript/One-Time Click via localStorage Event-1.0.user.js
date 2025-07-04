// ==UserScript==
// @name         One-Time Click via Custom Event
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  通过自定义事件 tampermonkey-click 来点击一次按钮
// @match        http*://*.yes24.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 监听自定义事件
    window.addEventListener("tampermonkey-click", (event) => {
        console.log("🎯 收到点击事件:", event.detail);

        // 尝试点击按钮
        const btn = window.frames[0].document.querySelector('img.booking[src*="btn_booking2.gif"]');
        if (btn) {
            btn.click();
            console.log("✅ 已点击按钮");
            // 尝试发送成功通知给主脚本
            try {
                window.parent.postMessage({type: 'tampermonkey-success', action: 'click'}, '*');
            } catch(e) {}
        } else {
            console.log("❌ 未找到按钮");
        }
    });

    // 也保留storage事件监听作为备用方案
    window.addEventListener("storage", (event) => {
        if (event.key === "CLICK_NOW" && event.newValue === "YES") {
            console.log("🔄 通过storage事件触发点击");
            const btn = document.querySelector('img.booking[src*="btn_booking2.gif"]');
            if (btn) {
                btn.click();
                console.log("✅ 已点击按钮");
            }
            localStorage.removeItem("CLICK_NOW");
        }
    });

    console.log("🚀 油猴脚本已加载，等待点击事件...");
})();