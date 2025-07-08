/*--------------------------------- 自定义配置 从表单获取 ---------------------------------*/
let seatSelect = []; // 没用 todo:增加自定义选座
let blockSelect = [25,26]; // 自定义选区 - 将从表单配置中获取
let SEAT_MAX_CLICK_COUNT = 30; // 单个座位最大点击次数
let WEBHOOK_URL = ''; // 飞书webhook url
let USERID = 'N20250703003241bf4'; // 用户id - 将从表单配置中获取
let MAX_SEAT_ID = 300; // 站票区刷到ID最大值，超过的票不锁  不需要筛ID请填9999
let REFRESH_INTERVAL = 500; // 刷新时间间隔 根据网络调整

/*--------------------------------- 配置加载函数 ---------------------------------*/
async function loadConfigFromForm(concertId) {
    try {
        let data = await get_stored_value(concertId);
        if (data) {
            // 更新USERID
            if (data['user-id']) {
                USERID = data['user-id'];
                concertcfg.idCustomer = USERID;
                toastSuccess(`✅ 用户ID已加载: ${USERID}`);
            }
            
            // 更新blockSelect
            if (data.section) {
                // 将字符串转换为数字数组
                blockSelect = data.section.split(',').map(num => parseInt(num.trim())).filter(num => !isNaN(num));
                toastSuccess(`✅ 区块配置已加载: [${blockSelect.join(', ')}]`);
            }
            
            toastInfo('⚙️ 表单配置加载完成');
            return data;
        } else {
            toastWarning('⚠️ 未找到表单配置，使用默认设置');
            return null;
        }
    } catch (error) {
        toastError(`❌ 配置加载失败: ${error.message}`);
        return null;
    }
}

/*--------------------------------- 勿修改 ---------------------------------*/
let isSuccess = false; // 是否成功
let currentSeatLayer = null;
let blackList = [];
let concertcfg = {};// 存储当前页面的concertcfg
concertcfg.idCustomer = USERID // idCustomer
let successBlock = "";
let successId = "";
let sendedIdList = [];

// region 队列
let seatQueue = [];// 可选座位队列
let secondSeatQueue = [];// 被锁过的座位队列 碰运气
function addSeatToQueue(seat) {
    seatQueue.push(seat);
}

function getSeatFromQueue() {
    return seatQueue[0];
}

function popSeatFromQueue() {
    return seatQueue.shift()
}
// endregion


//region 页面操作
function getConcertId() {
    let url = window.location.href;
    let concertId = url.split("=")[1];
    return concertId;
}

async function selectDate(data) {
    let date = data.date;
    let time = data.time;
    if (date) {
        document.getElementById(date).click();
        await sleep(500);
        if (time) {
            console.log("time", time);
            console.log(document.getElementsByTagName("li"));
            let lis = document.getElementsByTagName("li");
            for (let i = 0; i < lis.length; i++) {
                if (lis[i].innerText.includes(time)) {
                    lis[i].click();
                }
            }
        }
    }
    document.getElementById("btnSeatSelect").click();
}

function TampermonkeyClick() {
    // 直接触发自定义事件，而不是依赖storage事件
    const clickEvent = new CustomEvent('tampermonkey-click', {
        detail: { timestamp: Date.now() }
    });
    toastInfo('TampermonkeyClick...');
    window.dispatchEvent(clickEvent);
}


function theFrame() {
    return window.frames[0].document;
}

function theTopWindow() {
    return window.document;
}

// 获取cookie
function getCookie() {
    let frame = theTopWindow();
    return frame.cookie;
}

// 获取iframe中的idHall, idTime, idCustomer
function getUserInfo() {
    toastInfo('🔍 开始获取用户信息...');

    const iframe = document.querySelector('iframe');
    if (!iframe) {
        toastError('❌ 未找到iframe元素');
        return;
    }

    toastInfo('✅ 找到iframe，解析中...');

    let src = iframe.src;
    //https://ticket.yes24.com/Pages/English/Sale/FnPerfSaleHtmlSeat.aspx?idTime=1366809&idHall=13219&block=0&stMax=10&pHCardAppOpt=0
    try {
        let idHall = src.split("idHall=")[1].split("&")[0];
        let idTime = src.split("idTime=")[1].split("&")[0];

        toastSuccess(`📊 参数解析成功<br>Hall: ${idHall}<br>Time: ${idTime}`);

        concertcfg.idHall = idHall;
        concertcfg.idTime = idTime;

        toastInfo('⚙️ 配置设置完成');
    } catch (error) {
        toastError(`❌ 解析URL失败<br>${error.message}`);
    }
}

function clickStepCtrlBtn03() {
    let frame = theTopWindow();
    frame.getElementById("StepCtrlBtn03").children[1].click();
}
function clickStepCtrlBtn04() {
    let frame = theTopWindow();
    frame.getElementById("StepCtrlBtn04").children[1].click();
}

// 拉起信用卡支付
function openPayment() {
    let frame = theTopWindow();
    frame.getElementById("rdoPays2").click();
    frame.getElementById("cbxUserInfoAgree").click();
    frame.getElementById("cbxCancelFeeAgree").click();
    frame.getElementById("StepCtrlBtn05").children[1].click();
}

// 断言锁定成功
function assertLockSuccess() {
    let frame = theTopWindow();
    const el = frame.querySelector('#StepCtrlBtn03');
    if (el && el.style.display === 'block') {
        console.log('✅ class 正确：m03 on');
        return true;
    } else {
        console.log('❌ class 不匹配');
        return false;
    }
}

//选内场/看台 
function selectRange(idx) {
    if (isSuccess) {
        return;
    }
    // 优先尝试在父窗口中查找grade元素
    let parentDoc = theTopWindow();
    let frame = theFrame();
    if (idx == 1) {
        // 看台页面 - 尝试多种可能的元素
        let elements = [
            parentDoc.getElementById("grade_지정석"),
            frame.getElementById("grade_지정석"),
            parentDoc.querySelector('[id*="grade_"]'),
            frame.querySelector('[id*="grade_"]')
        ];
        
        for (let element of elements) {
            if (element) {
                element.click();
                currentSeatLayer = 1;
                isPageReady = true;
                return;
            }
        }
    } else {
        // 内场页面 - 尝试多种可能的元素
        let elements = [
            parentDoc.getElementById("grade_스탠딩"),
            frame.getElementById("grade_스탠딩"),
            parentDoc.querySelector('[id*="grade_"][id*="스탠딩"]'),
            frame.querySelector('[id*="grade_"][id*="스탠딩"]')
        ];
        
        for (let element of elements) {
            if (element) {
                element.click();
                currentSeatLayer = 2;
                isPageReady = true;
                return;
            }
        }
    }
}

async function enterPage(block) {
    let frame = theFrame();
    let seatLayer = frame.getElementsByClassName("seat_layer");

    // 检查seatLayer是否存在且不为空
    if (!seatLayer || seatLayer.length === 0) {
        // 如果block为1开头为内场 打开内场page
        if (block.toString().startsWith("1")) {
            selectRange(2);
            await sleep(300);
        }
        else {
            selectRange(1);
            await sleep(300);
        }
    }

    // 遍历找到block
    frame = theFrame();
    let seatLayerChildren = frame.getElementsByClassName("seat_layer")[0].children;
    for (let i = 0; i < seatLayerChildren.length; i++) {
        let seatLayerChild = seatLayerChildren[i];
        if (seatLayerChild.textContent.includes(block)) {
            seatLayerChild.click();
            await sleep(300);
            return;
        }
    }
    // 如果遍历完没有找到block，说明在另一个page
    if (block.toString().startsWith("1")) {
        selectRange(2);
        await sleep(300);
    }
    else {
        selectRange(1);
        await sleep(300);
    }
    frame = theFrame();
    seatLayerChildren = frame.getElementsByClassName("seat_layer")[0].children;
    for (let i = 0; i < seatLayerChildren.length; i++) {
        let seatLayerChild = seatLayerChildren[i];
        if (seatLayerChild.textContent.includes(block)) {
            seatLayerChild.click();
            await sleep(300);
            return;
        }
    }
}

// 接口锁定后 选择座位 去支付
async function chooseSeatAndGotoPayment(block,seatId) {
    await enterPage(block);
    await sleep(400);
    let frame = theFrame();
    let seat = frame.getElementById("t" + seatId.toString());
    if (seat && !seat.className.includes("s13")) {
        // 如果seat的class不包含son，则点击 son说明已选中
        if (!seat.className.includes("son")) {
            seat.click();
        }
        await sleep(1000);
        // while(!assertLockSuccess()){
            TampermonkeyClick();
            await sleep(1000);
        // }
    }
}
// endregion

//region 接口操作

async function sendSearchSeatRequest(block) {
    console.log(`[DEBUG] 开始发送请求，区块: ${block}`);

    // 检查必要参数
    if (!concertcfg.idHall || !concertcfg.idTime || !concertcfg.idCustomer) {
        console.error('[DEBUG] 缺少必要参数:', {
            idHall: concertcfg.idHall,
            idTime: concertcfg.idTime,
            idCustomer: concertcfg.idCustomer
        });
        return;
    }

    const url = 'https://ticket.yes24.com/OSIF/Book.asmx/GetBookWholeFN';
    let cookie = getCookie();

    console.log(`[DEBUG] Cookie长度: ${cookie ? cookie.length : 0}`);
    console.log(`[DEBUG] URL: ${url}`);

    const body = new URLSearchParams({
        idHall: concertcfg.idHall,
        idTime: concertcfg.idTime,
        block: block,
        channel: '1',
        idCustomer: concertcfg.idCustomer,
        idOrg: '1'
    });

    console.log(`[DEBUG] 请求体:`, body.toString());

    const headers = {
        'Host': 'ticket.yes24.com',
        'Connection': 'keep-alive',
        'Content-Length': '85',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': navigator.userAgent,
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://ticket.yes24.com',
        'Referer': `https://ticket.yes24.com/Pages/English/Sale/FnPerfSaleHtmlSeat.aspx?idTime=${concertcfg.idTime}&idHall=${concertcfg.idHall}&block=${block}&stMax=10&pHCardAppOpt=0`,
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Cookie': cookie
    };

    console.log(`[DEBUG] 准备发送fetch请求...`);

    // 发送请求
    fetch(url, {
            method: 'POST',
            headers: headers,
            body: body,
            credentials: 'include',
    })
        .then(response => response.text())
        .then(data => {
        console.log(`[DEBUG] 响应数据长度:`, data.length);
            parseResponse(data);
        console.log(`[YES24 info] Block ${block} 请求成功`);
        })
        .catch(err => {
        console.error(`[YES24 Error] Block ${block} 请求失败:`, err.message);
        console.error(`[DEBUG] 错误详情:`, err);
        // 如果是超时或网络错误，可以考虑重试
        if (err.message.includes('超时') || err.message.includes('Failed to fetch')) {
            console.log(`[YES24 info] Block ${block} 将在下次循环中重试`);
        }
        });
}

async function sendSeatLockRequest(block,seatId,sendmsg=false) {
    if (isSuccess) {
        return;
    }
    
    console.log(`[DEBUG] 开始发送Lock请求，区块: ${block} 座位ID: ${seatId}`);

    const url = 'https://ticket.yes24.com/OSIF/Book.asmx/Lock';
    let cookie = getCookie();

    console.log(`[DEBUG] Cookie长度: ${cookie ? cookie.length : 0}`);
    console.log(`[DEBUG] URL: ${url}`);

    const body = new URLSearchParams({
        name: concertcfg.idCustomer,
        idTime: concertcfg.idTime,
        token:seatId,
        block: block,
        channel: '1024',
        organizationID: '1'
    });

    console.log(`[DEBUG] 请求体:`, body.toString());

    const headers = {
        'Host': 'ticket.yes24.com',
        'Connection': 'keep-alive',
        'Content-Length': '85',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': navigator.userAgent,
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://ticket.yes24.com',
        'Referer': `https://ticket.yes24.com/Pages/English/Sale/FnPerfSaleHtmlSeat.aspx?idTime=${concertcfg.idTime}&idHall=${concertcfg.idHall}&block=${block}&stMax=10&pHCardAppOpt=0`,
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Cookie': cookie
    };

    console.log(`[DEBUG] 准备发送fetch请求...`);

    // 发送请求
    fetch(url, {
            method: 'POST',
            headers: headers,
            body: body,
            credentials: 'include',
    })
        .then(response => response.text())
        .then(data => {
        console.log(`[DEBUG] Lock响应数据:`, data);
        
        // 解析XML响应
        const codeMatch = data.match(/<Code>(.*?)<\/Code>/);
        const messageMatch = data.match(/<Message>(.*?)<\/Message>/);
        
        if (codeMatch) {
            const code = codeMatch[1];
            const message = messageMatch ? messageMatch[1] : '';
            
            // 锁定响应处理
            
            if (code === 'None') {
                isSuccess = true; // 设置成功标志
                successBlock = block;
                successId = seatId;
                showToast(`🎉 座位锁定成功！<br>区块: ${block} 座位: ${seatId}`, 'success', 5000);
                sendFeiShuMsg(WEBHOOK_URL, `[${new Date().toLocaleString()}]座位接口锁定成功: block:${block} seat:${seatId}`);
            } else if (code === 'block') {
                showToast(`⚠️ 被系统block<br>需要验证码`, 'error', 4000);
                sendFeiShuMsg(WEBHOOK_URL, `[${new Date().toLocaleString()}]被block: block:${block} seat:${seatId}`);
            } else {
                showToast(`❌ 锁定失败<br>区块: ${block} 座位: ${seatId}<br>错误: ${code}`, 'error', 3000);
                if (sendmsg) {
                    sendFeiShuMsg(WEBHOOK_URL, `[${new Date().toLocaleString()}]锁定失败: block:${block} seat:${seatId} Code=${code} Message=${message}`);
                }
            }
        } else {
            toastError(`❌ 无法解析锁定响应`);
        }
        })
        .catch(err => {
        toastError(`🚫 锁定请求失败<br>区块: ${block} 座位: ${seatId}`);
        sendFeiShuMsg(WEBHOOK_URL, `[${new Date().toLocaleString()}]Lock请求失败: block:${block} seat:${seatId} Error=${err.message}`);
        })
}

function parseLayoutData(xmlString) {
    // 解析Layout数据，提取座位信息
    // 开始解析Layout数据
    
    // 获取Layout内容
    const layoutMatch = xmlString.match(/<Layout>(.*?)<\/Layout>/s);
    const layoutData = layoutMatch ? layoutMatch[1] : "";
    
    let layoutSortById = {}; // 存储座位ID和递增序号的对应关系
    
    if (layoutData) {
        
        // 使用正则表达式匹配所有DIV元素
        const divRegex = /&lt;DIV[^&]*?&gt;&lt;\/DIV&gt;/g;
        const divMatches = layoutData.match(divRegex);
        
        if (divMatches) {
            let sortIndex = 1; // 递增序号从1开始
            
            divMatches.forEach(divHtml => {
                // 解析每个DIV的属性
                const idMatch = divHtml.match(/id=([^&\s]+)/);
                const styleMatch = divHtml.match(/style="([^"]+)"/);
                const valueMatch = divHtml.match(/value="([^"]+)"/);
                
                if (idMatch && valueMatch) {
                    let seatId = idMatch[1];
                    // 存储到layoutSortById对象中，key为座位ID，value为递增序号
                    layoutSortById[seatId] = sortIndex;
                    sortIndex++; // 递增序号
                }
            });
            
            // layoutSortById对象处理完成
        }
    }
    
    return layoutSortById; // 添加return语句
}

function parseResponse(xmlString) {
    // 使用正则表达式解析XML，避免使用DOMParser
    let layoutSortById = {};
    // 先尝试解析Layout数据
    if (xmlString.includes('<Layout>')) {
        layoutSortById = parseLayoutData(xmlString);
    }

    // 获取 Block 值
    const blockMatch = xmlString.match(/<Block>(.*?)<\/Block>/);
    const block = blockMatch ? blockMatch[1] : null;


    // 获取 BlockSeat 内容
    const blockSeatMatch = xmlString.match(/<BlockSeat>(.*?)<\/BlockSeat>/);
    const blockSeatData = blockSeatMatch ? blockSeatMatch[1] : "";

    if (blockSeatData) {
        // 使用 ^ 分割每个座位数据
        const seats = blockSeatData.split('^');

        seats.forEach(seatData => {
            if (seatData.trim()) {
                // 使用 @ 分割座位信息，第一个是座位ID
                const seatInfo = seatData.split('@');
                if (seatInfo.length > 0) {
                    const seatId = seatInfo[0];
                    let chooseable = seatInfo[2];
                    let seat = {};
                    seat.id = seatId;
                    seat.block = block;
                    
                    let seatElementIdx = layoutSortById["t"+seatId];
                    if (!sendedIdList[seatId]){
                        sendFeiShuMsg(WEBHOOK_URL, `[${new Date().toLocaleString()}]刷到座位 block:${block} seat:${seatId} index:${seatElementIdx},seatInfo:${seatInfo}`)
                        sendedIdList[seatId] = true;
                    }
                    // 检查是否站票超过ID最大值
                    if (seatElementIdx && seatElementIdx > MAX_SEAT_ID && block.toString().startsWith("1")) {
                        // sendFeiShuMsg(WEBHOOK_URL, `站票超过ID最大值，不锁票 block:${block} seat:${seatId} index:${seatElementIdx},seatInfo:${seatInfo}`)
                        return;
                    }
                    
                    if (!isSuccess) {
                        if (chooseable == "0") {
                            showToast(`🎯 发现空座！<br>区块: ${block} 座位: ${seatId}<br>序号: ${seatElementIdx}`, 'success', 2000);
                            addSeatToQueue(seat);
                            sendFeiShuMsg(WEBHOOK_URL,`[${new Date().toLocaleString()}]刷到空座，直接接口锁定 block:${block} seat:${seatId} index:${seatElementIdx},seatInfo:${seatInfo}`)
                        }else{
                            showToast(`🔍 发现座位<br>区块: ${block} 座位: ${seatId}<br>序号: ${seatElementIdx}`, 'warning', 1500);
                            secondSeatQueue.push(seat);
                        }
                    }
                }
            }
        });
    }
}
// endregion


//region 主流程
// producer：搜索可用座位添加到列表
async function searchSeat() {
    getUserInfo();
    await sleep(1000);
    let i = 0;
    let requestCount = 0;
    await sleep(1000);
    toastInfo(`🚀 开始搜索座位<br>目标区块: [${blockSelect.join(', ')}]<br>用户ID: ${USERID}`);
    while (!isSuccess) {
        if (seatQueue.length > 0) {
            await sleep(10);
            continue;
        }
        if (isSuccess) {
            break;
        }
        // 一直循环遍历blockSelect
        sendSearchSeatRequest(blockSelect[i]);
        i = (i + 1) % blockSelect.length;
        requestCount++;
        await sleep(50);
        if (requestCount % 8 === 0) {
            requestCount = 0;
            await sleep(REFRESH_INTERVAL);
        }
    }
}

async function trySecondSeat(){
    if (seatQueue.length == 0 && secondSeatQueue.length > 0 && !isSuccess) {
        let seat = secondSeatQueue.shift();
        if (seat) {
            sendSeatLockRequest(seat.block,seat.id,true)
            await sleep(2000);
        }
    }
}

// consumer：从列表中获取座位并尝试锁定
async function lockSeat() {
    let concertId = getConcertId();
    toastInfo('⏳ 开始抢票流程...', 2000);
    
    // 加载表单配置
    let data = await loadConfigFromForm(concertId);
    if (!data) {
        toastError('❌ 请先在扩展中配置抢票信息！');
        return;
    }
    
    await sleep(3000);
    selectDate(data);
    await sleep(2000);
    searchSeat(); // 启动爬虫
    selectRange(1);
    while (!isSuccess) {
        if (seatQueue.length > 0) {
            let seat = getSeatFromQueue();
            if (seat) {
                sendSeatLockRequest(seat.block,seat.id,true)
            }
            popSeatFromQueue();
            await sleep(300)
        }else{
            await sleep(10);
        }
    }
    // 接口锁成功的处理一下选座
    toastSuccess(`🎊 抢票成功！<br>正在处理选座和支付...`, 6000);
    sendFeiShuMsg(WEBHOOK_URL, `[${new Date().toLocaleString()}]抢票成功 successBlock:${successBlock} successId:${successId}`);
    await chooseSeatAndGotoPayment(successBlock,successId);
    await sleep(1000);
    clickStepCtrlBtn03();
    await sleep(2000);
    clickStepCtrlBtn04();
    await sleep(1000);
    // openPayment();
}

lockSeat();

// endregion


// region 测试
function testAddSeatToQueue(block,seatId){
    let seat = {};
    seat.id = seatId;
    seat.block = block;
    addSeatToQueue(seat);   
}
// endregion

//#region 
/*--------------------------------- Toast 弹窗函数 ---------------------------------*/
function showToast(message, type = 'info', duration = 3000) {
    // 移除已存在的toast
    const existingToast = document.getElementById('yes24-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 创建toast元素
    const toast = document.createElement('div');
    toast.id = 'yes24-toast';
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
//#endregion