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

    // Toast样式定义
    const toastStyles = `
        .tampermonkey-toast {
            position: fixed;
            left: -300px;
            top: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 99999;
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            max-width: 280px;
            border-left: 4px solid #fff;
        }
        
        .tampermonkey-toast.show {
            left: 20px;
            opacity: 1;
        }
        
        .tampermonkey-toast.success {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }
        
        .tampermonkey-toast.error {
            background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
        }
        
        .tampermonkey-toast.info {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
    `;

    // 注入样式
    const styleSheet = document.createElement('style');
    styleSheet.textContent = toastStyles;
    document.head.appendChild(styleSheet);

    // Toast显示函数
    function showToast(message, type = 'info', duration = 3000) {
        // 移除之前的toast
        const existingToast = document.querySelector('.tampermonkey-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `tampermonkey-toast ${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // 触发显示动画
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        // 自动隐藏
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 400);
        }, duration);
    }

    // 监听自定义事件
    window.addEventListener("tampermonkey-click", (event) => {
        console.log("🎯 收到点击事件:", event.detail);
        
        if (event.detail && event.detail.debug) {
            showToast("🔍 调试模式：开始智能搜索按钮...", 'info');
            
            // 基于实际HTML结构的精确选择器
            const preciseSelectors = [
                // 基于实际发现的结构 - 优先级最高
                'a[href="javascript:ChoiceEnd();"] img[src*="btn_booking2.gif"]',
                'a[href="javascript:ChoiceEnd();"]',
                'img[src*="btn_booking2.gif"][alt*="좌석선택완료"]',
                'img.booking[src*="btn_booking2.gif"]',
                
                // 通用选择器作为备选
                'img[src*="btn_booking"]',
                'img[src*="booking"]',
                'input[type="button"][value*="booking"]', 
                'input[type="button"][value*="예약"]',
                'button[id*="booking"]',
                'img[alt*="booking"]',
                'img[alt*="예약"]',
                'img[title*="booking"]',
                'img[title*="예약"]',
                '.booking',
                '#booking',
                'img[src*="btn_"]',
                'img[onclick*="booking"]',
                'img[onclick*="예약"]',
                'img[src*="예약"]',
                'img[src*="reservation"]',
                'button[onclick*="booking"]',
                // 新增JavaScript函数调用相关的选择器
                'a[href*="ChoiceEnd"]',
                'img[alt*="선택완료"]',
                'img[alt*="완료"]'
            ];
            
            let foundButton = null;
            let foundSelector = '';
            
            // 尝试在iframe中查找
            try {
                const iframeDoc = window.frames[0].document;
                
                for (const selector of preciseSelectors) {
                    const buttons = iframeDoc.querySelectorAll(selector);
                    if (buttons.length > 0) {
                        console.log(`✅ 找到按钮! 选择器: ${selector}`, buttons);
                        showToast(`✅ 找到 ${buttons.length} 个按钮<br>选择器: ${selector}`, 'success', 3000);
                        
                        // 输出所有找到的按钮信息
                        buttons.forEach((btn, idx) => {
                            console.log(`按钮 ${idx + 1}:`, {
                                tagName: btn.tagName,
                                src: btn.src,
                                alt: btn.alt,
                                title: btn.title,
                                value: btn.value,
                                className: btn.className,
                                id: btn.id,
                                href: btn.href,
                                onclick: btn.onclick ? btn.onclick.toString() : 'none',
                                outerHTML: btn.outerHTML.substring(0, 200) + '...'
                            });
                        });
                        
                        // 选择第一个可见的按钮
                        foundButton = Array.from(buttons).find(btn => {
                            const style = window.getComputedStyle(btn);
                            return style.display !== 'none' && style.visibility !== 'hidden';
                        }) || buttons[0];
                        
                        foundSelector = selector;
                        break;
                    }
                }
                
                if (foundButton) {
                    console.log("🎯 准备点击按钮:", foundButton);
                    showToast(`🎯 准备点击按钮<br>类型: ${foundButton.tagName}<br>选择器: ${foundSelector}`, 'info', 2000);
                    
                    // 特殊处理：如果找到的是img，但它在a标签内，则点击a标签
                    let targetElement = foundButton;
                    if (foundButton.tagName === 'IMG' && foundButton.parentElement && foundButton.parentElement.tagName === 'A') {
                        targetElement = foundButton.parentElement;
                        console.log("🔄 检测到img在a标签内，改为点击a标签:", targetElement);
                        showToast("🔄 智能切换到父级a标签", 'info', 1500);
                    }
                    
                    // 尝试多种点击方法
                    let clickSuccess = false;
                    
                    // 方法1: 直接点击
                    try {
                        targetElement.click();
                        console.log("✅ 方法1: click() 成功");
                        showToast("✅ 成功点击按钮！(方法1)", 'success', 4000);
                        clickSuccess = true;
                    } catch (e1) {
                        console.log("❌ 方法1失败，尝试方法2...", e1);
                        
                        // 方法2: 分发事件
                        try {
                            targetElement.dispatchEvent(new MouseEvent('click', {
                                view: window.frames[0],
                                bubbles: true,
                                cancelable: true
                            }));
                            console.log("✅ 方法2: dispatchEvent 成功");
                            showToast("✅ 成功点击按钮！(方法2)", 'success', 4000);
                            clickSuccess = true;
                        } catch (e2) {
                            console.log("❌ 方法2失败，尝试方法3...", e2);
                            
                            // 方法3: 直接调用href中的JavaScript
                            try {
                                if (targetElement.href && targetElement.href.includes('javascript:')) {
                                    const jsCode = targetElement.href.replace('javascript:', '');
                                    eval(jsCode);
                                    console.log("✅ 方法3: 执行JavaScript成功");
                                    showToast("✅ 成功执行JavaScript！(方法3)", 'success', 4000);
                                    clickSuccess = true;
                                } else if (targetElement.onclick) {
                                    targetElement.onclick();
                                    console.log("✅ 方法3: onclick() 成功");
                                    showToast("✅ 成功点击按钮！(方法3)", 'success', 4000);
                                    clickSuccess = true;
                                } else {
                                    throw new Error("没有可执行的点击事件");
                                }
                            } catch (e3) {
                                console.log("❌ 方法3失败，尝试方法4...", e3);
                                
                                // 方法4: 直接调用ChoiceEnd函数
                                try {
                                    if (typeof window.frames[0].ChoiceEnd === 'function') {
                                        window.frames[0].ChoiceEnd();
                                        console.log("✅ 方法4: 直接调用ChoiceEnd()成功");
                                        showToast("✅ 直接调用ChoiceEnd函数成功！(方法4)", 'success', 4000);
                                        clickSuccess = true;
                                    } else {
                                        throw new Error("ChoiceEnd函数不存在");
                                    }
                                } catch (e4) {
                                    console.log("❌ 所有点击方法都失败", e4);
                                }
                            }
                        }
                    }
                    
                    if (!clickSuccess) {
                        showToast("❌ 所有点击方法都失败", 'error', 4000);
                    }
                    
                } else {
                    console.log("❌ 未找到任何按钮");
                    showToast("❌ 未找到任何按钮，请检查页面状态", 'error', 4000);
                    
                    // 输出iframe中的所有img和button元素供调试
                    const allImgs = iframeDoc.querySelectorAll('img');
                    const allButtons = iframeDoc.querySelectorAll('button, input[type="button"]');
                    const allLinks = iframeDoc.querySelectorAll('a[href*="javascript"]');
                    
                    console.log("📋 iframe中的所有图片元素:", allImgs);
                    console.log("📋 iframe中的所有按钮元素:", allButtons);
                    console.log("📋 iframe中的所有JavaScript链接:", allLinks);
                    
                    if (allImgs.length > 0) {
                        console.log("前5个图片的详细信息:");
                        Array.from(allImgs).slice(0, 5).forEach((img, idx) => {
                            console.log(`图片 ${idx + 1}:`, {
                                src: img.src,
                                alt: img.alt,
                                className: img.className,
                                id: img.id,
                                parentTag: img.parentElement ? img.parentElement.tagName : 'none',
                                parentHref: img.parentElement && img.parentElement.href ? img.parentElement.href : 'none'
                            });
                        });
                    }
                }
                
            } catch (error) {
                console.error("❌ 查找按钮时出错:", error);
                showToast(`❌ 查找按钮时出错: ${error.message}`, 'error', 4000);
            }
            
        } else {
            // 原有的简单模式 - 也进行优化
            showToast("🎯 收到点击指令，正在查找按钮...", 'info');

            try {
                const iframeDoc = window.frames[0].document;
                
                // 优先尝试精确的选择器
                let btn = iframeDoc.querySelector('a[href="javascript:ChoiceEnd();"] img[src*="btn_booking2.gif"]');
                if (!btn) {
                    btn = iframeDoc.querySelector('a[href="javascript:ChoiceEnd();"]');
                }
                if (!btn) {
                    btn = iframeDoc.querySelector('img.booking[src*="btn_booking2.gif"]');
                }
                
                if (btn) {
                    // 如果是img并且父元素是a，点击a标签
                    const targetElement = (btn.tagName === 'IMG' && btn.parentElement && btn.parentElement.tagName === 'A') 
                        ? btn.parentElement 
                        : btn;
                        
                    targetElement.click();
                    console.log("✅ 已点击按钮");
                    showToast("✅ 成功找到并点击预订按钮！", 'success', 4000);
                    
                    // 尝试发送成功通知给主脚本
                    try {
                        window.parent.postMessage({type: 'tampermonkey-success', action: 'click'}, '*');
                    } catch(e) {}
                } else {
                    console.log("❌ 未找到按钮");
                    showToast("❌ 未找到预订按钮，请检查页面状态", 'error', 4000);
                }
            } catch (error) {
                console.error("❌ 简单模式点击失败:", error);
                showToast(`❌ 点击失败: ${error.message}`, 'error', 4000);
            }
        }
    });

    // 也保留storage事件监听作为备用方案
    window.addEventListener("storage", (event) => {
        if (event.key === "CLICK_NOW" && event.newValue === "YES") {
            console.log("🔄 通过storage事件触发点击");
            showToast("🔄 通过存储事件触发点击", 'info');
            
            const btn = document.querySelector('img.booking[src*="btn_booking2.gif"]');
            if (btn) {
                btn.click();
                console.log("✅ 已点击按钮");
                showToast("✅ 通过存储事件成功点击按钮！", 'success');
            } else {
                showToast("❌ 存储事件：未找到按钮", 'error');
            }
            localStorage.removeItem("CLICK_NOW");
        }
    });

    console.log("🚀 油猴脚本已加载，等待点击事件...");
    showToast("🚀 油猴脚本已就绪，等待点击指令", 'info', 2000);
})();