async function sleep(t) {
    return await new Promise(resolve => setTimeout(resolve, t));
}

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

// 进度统计变量
let searchStats = {
    attempts: 0,
    currentSection: '',
    startTime: Date.now(),
    sectionsSearched: []
};

function theFrame() {
    if (window._theFrameInstance == null) {
      window._theFrameInstance = document.getElementById('oneStopFrame').contentWindow;
    }
  
    return window._theFrameInstance;
}

function getConcertId() {
    return document.getElementById("prodId").value;
}

function openEverySection() {
    let frame = theFrame();
    let section = frame.document.getElementsByClassName("seat_name");
    console.log(section);
    for (let i = 0; i < section.length; i++) {
        section[i].parentElement.click();
    }
}

function clickOnArea(area) {
    let frame = theFrame();
    let section = frame.document.getElementsByClassName("area_tit");
    
    // 更新当前搜索区块
    searchStats.currentSection = area;
    if (!searchStats.sectionsSearched.includes(area)) {
        searchStats.sectionsSearched.push(area);
    }
    
    for (let i = 0; i < section.length; i++) {
        let reg = new RegExp(area + "\$","g");
        if (section[i].innerHTML.match(reg)) {
            section[i].parentElement.click();
            
            // 显示当前搜索的区块
            toastInfo(`🔍 正在搜索区块: ${area}<br>已搜索过区块: [${searchStats.sectionsSearched.join(', ')}]`, 2000);
            
            return;
        }
    }
    
    // 如果没找到区块，显示警告
    toastWarning(`⚠️ 未找到区块: ${area}<br>请检查区块是否存在`, 3000);
}

async function findSeat() {
    let frame = theFrame();
    let canvas = frame.document.getElementById("ez_canvas");
    let seat = canvas.getElementsByTagName("rect");
    
    searchStats.attempts++;
    console.log(seat);
    
    // 显示搜索进度
    const elapsed = Math.floor((Date.now() - searchStats.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
    
    toastInfo(`⏳ 搜索座位中...<br>区块: ${searchStats.currentSection}<br>尝试次数: ${searchStats.attempts}<br>运行时间: ${timeStr}`, 1500);
    
    await sleep(750);
    for (let i = 0; i < seat.length; i++) {
        let fillColor = seat[i].getAttribute("fill");
    
        // Check if fill color is different from #DDDDDD or none
        if (fillColor !== "#DDDDDD" && fillColor !== "none") {
            console.log("Rect with different fill color found:", seat[i]);
            
            toastSuccess(`🎉 找到可用座位！<br>区块: ${searchStats.currentSection}<br>座位颜色: ${fillColor}<br>正在预订...`, 4000);
            
            var clickEvent = new Event('click', { bubbles: true });
            seat[i].dispatchEvent(clickEvent);
            frame.document.getElementById("nextTicketSelection").click();
            return true;
        }
    }
    
    toastWarning(`😞 区块 ${searchStats.currentSection} 暂无可用座位<br>继续搜索其他区块...`, 1500);
    return false;
}

async function checkCaptchaFinish() {
    if (document.getElementById("certification").style.display != "none") {
        toastWarning("🔐 请完成验证码验证<br>验证完成后将自动继续...", 2000);
        await sleep(1000);
        checkCaptchaFinish();
        return;
    }
    
    toastSuccess("✅ 验证码验证完成！<br>继续座位预订流程...", 3000);
    let frame = theFrame();
    await sleep(500);
    frame.document.getElementById("nextTicketSelection").click();
    return;
}

async function reload() {
    toastInfo("🔄 重新加载页面<br>准备新一轮搜索...", 2000);
    let frame = theFrame();
    frame.document.getElementById("btnReloadSchedule").click();
    await sleep(750);
}

async function searchSeat(data) {
    // 将字符串分割成数组，过滤空值并去除空格
    const sections = data.section.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    for (let sec of sections) {
        openEverySection();
        clickOnArea(sec);
        if (await findSeat()) {
            checkCaptchaFinish();
            return;
        }
    }
    reload();
    await searchSeat(data);
}

async function waitFirstLoad() {
    let concertId = getConcertId();
    let data = await get_stored_value(concertId);
    
    if (!data) {
        toastError("❌ 未找到配置数据！<br>请先在扩展中配置抢票信息", 5000);
        return;
    }
    
    // 显示开始信息
    const sections = data.section ? data.section.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
    toastInfo(`🎯 开始座位搜索<br>演唱会ID: ${concertId}<br>目标区块: [${sections.join(', ')}]<br>准备开始抢票...`, 4000);
    
    // 初始化搜索统计
    searchStats.startTime = Date.now();
    searchStats.attempts = 0;
    searchStats.sectionsSearched = [];
    
    await sleep(1000);
    searchSeat(data);
}


waitFirstLoad();