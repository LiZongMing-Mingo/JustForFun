// Toast 弹窗系统
function showToast(message, type = 'info', duration = 3000) {
    // 移除已存在的toast
    const existingToast = document.getElementById('melon-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 创建toast元素
    const toast = document.createElement('div');
    toast.id = 'melon-toast';
    toast.innerHTML = message;
    
    // 设置基础样式
    const baseStyle = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 300px;
        padding: 12px 16px;
        border-radius: 6px;
        color: white;
        font-size: 14px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
        word-wrap: break-word;
        line-height: 1.4;
    `;
    
    // 根据类型设置不同颜色
    let typeColor;
    switch(type) {
        case 'success':
            typeColor = 'background: linear-gradient(135deg, #4CAF50, #45a049);';
            break;
        case 'error':
            typeColor = 'background: linear-gradient(135deg, #f44336, #d32f2f);';
            break;
        case 'warning':
            typeColor = 'background: linear-gradient(135deg, #ff9800, #f57c00);';
            break;
        case 'info':
        default:
            typeColor = 'background: linear-gradient(135deg, #2196F3, #1976D2);';
            break;
    }
    
    toast.style.cssText = baseStyle + typeColor;
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 自动消失
    setTimeout(() => {
        if (toast && toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast && toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }
    }, duration);
}

// 快捷Toast函数
function toastSuccess(msg, duration = 4000) { showToast(msg, 'success', duration); }
function toastError(msg, duration = 4000) { showToast(msg, 'error', duration); }
function toastWarning(msg, duration = 3000) { showToast(msg, 'warning', duration); }
function toastInfo(msg, duration = 3000) { showToast(msg, 'info', duration); }

// 格式化时间函数
function formatTime(time) {
    // 将 "14:00" 格式转换为 "14:00" 或其他需要的格式
    return time;
}

// 存储函数
function get_stored_value(key) {
    return new Promise((resolve) => {
        chrome.storage.sync.get(key, function(value) {
            resolve(value[key]);
        });
    });
}

function store_value(key, value) {
    chrome.storage.sync.set({
        [key]: value,
    })
}

function delete_value(key) {
    chrome.storage.sync.remove(key);
}

async function sleep(t) {
    return await new Promise(resolve => setTimeout(resolve, t));
}

function getConcertId() {
    return document.getElementById("prodIdNum").value;
}

function select_day(day) {
    let daysAvaible = document.getElementById("list_date");
    let num = daysAvaible.childElementCount;
    if (num <= 1) return;

    for (let i = 0; i < num; i++) {
        let dayElement = daysAvaible.children[i];
        if (dayElement.getAttribute("data-perfday") == day) {
            dayElement.children[0].click();
            return;
        }
    }
    return;
}

function select_time(time) {
    let timesAvaible = document.getElementById("list_time");
    let num = timesAvaible.childElementCount;
    if (num <= 1) return;

    for (let i = 0; i < num; i++) {
        let timeElement = timesAvaible.children[i];
        if (timeElement.children[0].children[0].innerHTML.includes(time)) {
            timeElement.children[0].click();
            return;
        }
    }
    return;
}

async function isPlaceOpen() {
    let selector = document.getElementsByClassName("box_ticketing_process")[0];
    
    if (selector.style.display == "none") {
        return false;
    }
    return true;
}

async function searchConcert() {
    let concertId = getConcertId();
    let data = await get_stored_value(concertId);

    if (!data) {
        toastError("❌ 未找到配置数据！<br>请先在扩展中配置抢票信息", 5000);
        return;
    }
    
    toastInfo(`🚀 开始抢票流程<br>演唱会ID: ${concertId}<br>目标日期: ${data.date}<br>目标时间: ${data.time}<br>目标区块: ${data.section}`, 4000);
    
    if (!await isPlaceOpen()) {
        toastWarning("⏳ 等待购票开启...", 2000);
        console.log("not open");
        await sleep(200);
        searchConcert();
        return;
    }
    
    toastSuccess("✅ 购票已开启！开始选择日期和时间...", 3000);
    
    await sleep(500);
    select_day(data.date.replaceAll("-", ""));
    toastInfo(`📅 已选择日期: ${data.date}`, 2000);
    
    await sleep(500);
    select_time(formatTime(data.time));
    toastInfo(`⏰ 已选择时间: ${data.time}`, 2000);
    
    await sleep(500);

    toastInfo("🎯 准备进入座位选择页面...", 3000);
    await sleep(5000);
    
    document.getElementsByClassName("reservationBtn")[0].click();
    toastSuccess("🎊 已点击预订按钮！<br>正在跳转到座位选择页面...", 4000);

    console.log("clicked reservation");
}

function simulateMouseEvent(element, eventType) {
    const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        isTrusted: true,
    });

    element.dispatchEvent(event);
}

searchConcert();