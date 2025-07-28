/*--------------------------------- 自定义配置 从表单获取 ---------------------------------*/
let seatSelect = []; // 没用 todo:增加自定义选座
let blockSelect = [25,26]; // 自定义选区 - 将从表单配置中获取
let SEAT_MAX_CLICK_COUNT = 30; // 单个座位最大点击次数
let WEBHOOK_URL = 'https://www.feishu.cn/flow/api/trigger-webhook/b5393db194f0afb44a06d58102e3c68e'; // 飞书webhook url
let USERID = 'N20250703003241bf4'; // 用户id - 将从表单配置中获取
let MAX_SEAT_ID = 9999; // 站票区刷到ID最大值，超过的票不锁  不需要筛ID请填9999
let REFRESH_INTERVAL = 300; // 刷新时间间隔 根据网络调整

// 搜索进度提示配置
let PROGRESS_INTERVAL = 30; // 每N次请求显示一次进度（可调整：15=频繁提示, 50=较少提示）
let PROGRESS_SHOW_SPEED = true; // 是否显示搜索速度
let PROGRESS_SHOW_QUEUE = true; // 是否显示队列状态

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
let currentRound = 1; // 当前轮次计数器

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
    // 安全检查：确保frames存在且不为空
    if (!window.frames || window.frames.length === 0) {
        console.error('[DEBUG] window.frames不存在或为空');
        return null;
    }
    
    // 安全检查：确保第一个frame存在且有document
    if (!window.frames[0] || !window.frames[0].document) {
        console.error('[DEBUG] 第一个frame不存在或没有document');
        return null;
    }
    
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
    
    // 安全检查：确保frame存在
    if (!frame) {
        console.error('[DEBUG] selectRange: 无法获取iframe内容');
        toastWarning('⚠️ 无法访问页面内容<br>💡 请检查页面是否正常加载', 3000);
        return;
    }
    
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
    
    // 如果所有尝试都失败，记录警告
    console.warn(`[DEBUG] selectRange: 未找到idx=${idx}对应的元素`);
    toastWarning(`⚠️ 未找到座位类型选择元素<br>💡 页面可能未完全加载`, 3000);
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
    let seatLayerElement = frame.getElementsByClassName("seat_layer")[0];
    
    // 安全检查：确保seat_layer元素存在
    if (!seatLayerElement) {
        console.log(`[DEBUG] 未找到seat_layer元素，尝试切换页面`);
        // 如果block为1开头为内场 打开内场page
        if (block.toString().startsWith("1")) {
            selectRange(2);
            await sleep(300);
        }
        else {
            selectRange(1);
            await sleep(300);
        }
        // 重新获取frame和seat_layer
        frame = theFrame();
        seatLayerElement = frame.getElementsByClassName("seat_layer")[0];
        
        // 如果还是找不到，记录错误并返回
        if (!seatLayerElement) {
            console.error(`[DEBUG] 切换页面后仍未找到seat_layer元素`);
            toastWarning(`⚠️ 无法找到座位层元素<br>区块: ${block}<br>💡 页面可能未完全加载`, 3000);
            return;
        }
    }
    
    let seatLayerChildren = seatLayerElement.children;
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
    seatLayerElement = frame.getElementsByClassName("seat_layer")[0];
    
    // 再次安全检查
    if (!seatLayerElement) {
        console.error(`[DEBUG] 第二次尝试仍未找到seat_layer元素`);
        toastWarning(`⚠️ 无法找到座位层元素<br>区块: ${block}<br>💡 页面可能未完全加载`, 3000);
        return;
    }
    
    seatLayerChildren = seatLayerElement.children;
    for (let i = 0; i < seatLayerChildren.length; i++) {
        let seatLayerChild = seatLayerChildren[i];
        if (seatLayerChild.textContent.includes(block)) {
            seatLayerChild.click();
            await sleep(300);
            return;
        }
    }
    
    // 如果所有尝试都失败，记录日志
    console.warn(`[DEBUG] 未找到区块 ${block} 的座位层`);
    toastWarning(`⚠️ 未找到区块 ${block}<br>💡 可能区块号无效或页面未完全加载`, 3000);
}

// 接口锁定后 选择座位 去支付
async function chooseSeatAndGotoPayment(block,seatId) {
    await enterPage(block);
    await sleep(400);
    let frame = theFrame();
    
    // 安全检查：确保frame存在
    if (!frame) {
        console.error('[DEBUG] 无法获取iframe内容');
        toastError('❌ 无法访问页面内容<br>💡 请检查页面是否正常加载', 4000);
        return;
    }
    
    let seat = frame.getElementById("t" + seatId.toString());
    if (seat && !seat.className.includes("s13")) {
        // 如果seat的class不包含son，则点击 son说明已选中
        if (!seat.className.includes("son")) {
            seat.click();
        }
        await sleep(700);
        // while(!assertLockSuccess()){
            TampermonkeyClick();
            await sleep(700);
        // }
    } else {
        console.warn(`[DEBUG] 未找到座位元素: t${seatId}`);
        toastWarning(`⚠️ 未找到座位 t${seatId}<br>💡 座位可能已被选择或不存在`, 3000);
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
        
        // 检查响应是否为空或异常
        if (!data || data.trim().length === 0) {
            console.error(`[DEBUG] 区块 ${block} 返回空响应`);
            showToast(`⚠️ 搜索响应为空<br>区块: ${block}<br>💡 服务器可能正在处理，继续重试`, 'warning', 3000);
            return;
        }
        
        // 检查是否为有效的XML格式
        if (!data.includes('<') || !data.includes('>')) {
            console.error(`[DEBUG] 区块 ${block} 返回非XML格式响应:`, data.substring(0, 200));
            showToast(`⚠️ 响应格式异常<br>区块: ${block}<br>💡 可能是网络问题或服务器错误`, 'warning', 3000);
            return;
        }
        
        // 检查是否包含错误信息
        if (data.includes('error') || data.includes('Error') || data.includes('ERROR')) {
            console.error(`[DEBUG] 区块 ${block} 响应包含错误:`, data.substring(0, 300));
            showToast(`❌ 服务器返回错误<br>区块: ${block}<br>💡 可能是区块无效或权限问题`, 'error', 4000);
            return;
        }
        
        parseResponse(data);
        console.log(`[YES24 info] Block ${block} 请求成功`);
        })
        .catch(err => {
        console.error(`[YES24 Error] Block ${block} 请求失败:`, err.message);
        console.error(`[DEBUG] 错误详情:`, err);
        
        // 详细的搜索错误信息
        let errorMsg = `🔍 搜索座位失败<br>区块: ${block}`;
        
        if (err.message) {
            errorMsg += `<br>错误: ${err.message}`;
        }
        
        // 根据错误类型提供不同的建议
        if (err.name === 'NetworkError' || err.message.includes('network')) {
            errorMsg += `<br>💡 网络连接问题，将在下次循环重试`;
        } else if (err.message.includes('timeout')) {
            errorMsg += `<br>💡 请求超时，服务器响应慢，继续重试`;
        } else if (err.message.includes('Failed to fetch')) {
            errorMsg += `<br>💡 网络请求失败，将在下次循环重试`;
        } else if (err.message.includes('403') || err.message.includes('Forbidden')) {
            errorMsg += `<br>💡 访问被拒绝，可能需要重新登录`;
        } else if (err.message.includes('404')) {
            errorMsg += `<br>💡 请求地址无效，检查区块号`;
        } else if (err.message.includes('500')) {
            errorMsg += `<br>💡 服务器内部错误，继续重试`;
        } else {
            errorMsg += `<br>💡 未知搜索错误，继续重试`;
        }
        
        // 只在严重错误时显示Toast，避免频繁弹窗
        if (!err.message.includes('Failed to fetch') && !err.message.includes('timeout')) {
            showToast(errorMsg, 'warning', 3000);
        }
        
        console.log(`[YES24 info] Block ${block} 将在下次循环中重试`);
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
        
        // 检查响应是否为空或异常
        if (!data || data.trim().length === 0) {
            console.error(`[DEBUG] 锁定请求返回空响应 区块: ${block} 座位: ${seatId}`);
            toastError(`❌ 锁定响应为空<br>区块: ${block} 座位: ${seatId}<br>💡 服务器可能正忙，稍后重试`, 4000);
            return;
        }
        
        // 检查是否为有效的XML格式
        if (!data.includes('<') || !data.includes('>')) {
            console.error(`[DEBUG] 锁定请求返回非XML格式响应:`, data.substring(0, 200));
            toastError(`❌ 锁定响应格式异常<br>区块: ${block} 座位: ${seatId}<br>💡 可能是网络问题`, 4000);
            return;
        }
        
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
                
                // 发送结构化成功消息
                const successData = {
                    round: currentRound,
                    successState: "成功",
                    failState: "",
                    block: parseInt(block),
                    seat: parseInt(seatId)
                };
                sendFeiShuStructuredMsg(WEBHOOK_URL, successData).then(result => {
                    if (!result || !result.success) {
                        logStructuredData(successData);
                    }
                });
            } 
            else if (code === 'block') {
                showToast(`⚠️ 被系统block<br>需要验证码`, 'error', 4000);
                
                // 发送验证码通知的结构化消息
                const captchaData = {
                    round: currentRound,
                    successState: "",
                    failState: "验证码",
                    block: parseInt(block),
                    seat: parseInt(seatId)
                };
                sendFeiShuStructuredMsg(WEBHOOK_URL, captchaData).then(result => {
                    if (!result || !result.success) {
                        logStructuredData(captchaData);
                    }
                });
            } 
            else {
                // 详细的错误信息处理
                let errorDetails = getErrorDetails(code, message);
                let toastMsg = `❌ 锁定失败<br>区块: ${block} 座位: ${seatId}<br>错误码: ${code || '无'}`;
                
                if (message && message.trim()) {
                    toastMsg += `<br>错误信息: ${message}`;
                }
                
                if (errorDetails.description) {
                    toastMsg += `<br>📝 ${errorDetails.description}`;
                }
                
                if (errorDetails.suggestion) {
                    toastMsg += `<br>💡 ${errorDetails.suggestion}`;
                }
                
                showToast(toastMsg, 'error', errorDetails.duration || 4000);
                
                if (sendmsg) {                    
                    // 发送结构化失败消息
                    const failData = {
                        round: currentRound,
                        successState: "",
                        failState: "失败",
                        block: parseInt(block),
                        seat: parseInt(seatId)
                    };
                    sendFeiShuStructuredMsg(WEBHOOK_URL, failData).then(result => {
                        if (!result || !result.success) {
                            logStructuredData(failData);
                        }
                    });
                }
            }
        } else {
            // 无法解析响应的情况
            console.log('[DEBUG] 无法解析的响应数据:', data);
            toastError(`❌ 无法解析锁定响应<br>区块: ${block} 座位: ${seatId}<br>原始响应: ${data.substring(0, 100)}...`);
        }
        })
        .catch(err => {
        // 详细的网络错误信息
        console.log('[DEBUG] 锁定请求失败:', err);
        let errorMsg = `🚫 锁定请求失败<br>区块: ${block} 座位: ${seatId}`;
        
        if (err.message) {
            errorMsg += `<br>错误: ${err.message}`;
        }
        
        // 根据错误类型提供不同的建议
        if (err.name === 'NetworkError' || err.message.includes('network')) {
            errorMsg += `<br>💡 网络连接问题，请检查网络`;
        } else if (err.message.includes('timeout')) {
            errorMsg += `<br>💡 请求超时，服务器响应慢`;
        } else if (err.message.includes('403') || err.message.includes('Forbidden')) {
            errorMsg += `<br>💡 访问被拒绝，可能需要重新登录`;
        } else if (err.message.includes('404')) {
            errorMsg += `<br>💡 请求地址无效`;
        } else if (err.message.includes('500')) {
            errorMsg += `<br>💡 服务器内部错误`;
        } else {
            errorMsg += `<br>💡 未知网络错误，请重试`;
        }
        
        toastError(errorMsg, 5000);
        })
}

// 获取错误详情说明
function getErrorDetails(code, message) {
    const errorMap = {
        '': {
            description: '服务器返回空错误码',
            suggestion: '座位可能已被其他用户锁定',
            duration: 3000
        },
        'null': {
            description: '返回空值',
            suggestion: '座位状态异常，继续尝试其他座位',
            duration: 3000
        },
        'undefined': {
            description: '未定义错误',
            suggestion: '座位数据异常，尝试其他座位',
            duration: 3000
        },
        'user': {
            description: '用户相关错误',
            suggestion: '检查用户ID是否有效',
            duration: 4000
        },
        'seat': {
            description: '座位不可用',
            suggestion: '座位已被锁定或不存在',
            duration: 3000
        },
        'time': {
            description: '时间相关错误',
            suggestion: '演出时间可能已过期或未开始',
            duration: 4000
        },
        'sold': {
            description: '座位已售出',
            suggestion: '座位已被购买，尝试其他座位',
            duration: 3000
        },
        'lock': {
            description: '座位被锁定',
            suggestion: '座位被其他用户临时锁定',
            duration: 3000
        },
        'locked': {
            description: '座位已锁定',
            suggestion: '座位被其他用户占用，尝试其他座位',
            duration: 3000
        },
        'occupied': {
            description: '座位被占用',
            suggestion: '座位已被其他用户选择',
            duration: 3000
        },
        'reserved': {
            description: '座位已预留',
            suggestion: '座位被预留，无法选择',
            duration: 3000
        },
        'system': {
            description: '系统错误',
            suggestion: '服务器内部错误，稍后重试',
            duration: 4000
        },
        'network': {
            description: '网络错误',
            suggestion: '检查网络连接',
            duration: 4000
        },
        'application': {
            description: '应用程序错误',
            suggestion: '座位数量限制或其他业务规则',
            duration: 4000
        },
        'session': {
            description: '会话过期',
            suggestion: '请重新登录',
            duration: 4000
        },
        'timeout': {
            description: '请求超时',
            suggestion: '服务器响应慢，重新尝试',
            duration: 4000
        },
        'invalid': {
            description: '无效请求',
            suggestion: '请求参数错误，检查座位信息',
            duration: 4000
        },
        'permission': {
            description: '权限不足',
            suggestion: '用户权限不够，检查登录状态',
            duration: 4000
        },
        'limit': {
            description: '超出限制',
            suggestion: '可能达到购票数量限制',
            duration: 4000
        },
        'maintenance': {
            description: '系统维护中',
            suggestion: '服务器正在维护，稍后重试',
            duration: 5000
        }
    };
    
    // 尝试精确匹配
    if (errorMap[code]) {
        return errorMap[code];
    }
    
    // 尝试部分匹配
    for (let key in errorMap) {
        if (code && code.toLowerCase().includes(key.toLowerCase())) {
            return errorMap[key];
        }
    }
    
    // 根据message内容判断
    if (message) {
        const msg = message.toLowerCase();
        if (msg.includes('sold') || msg.includes('购买')) {
            return errorMap['sold'];
        }
        if (msg.includes('lock') || msg.includes('锁定')) {
            return errorMap['lock'];
        }
        if (msg.includes('time') || msg.includes('时间')) {
            return errorMap['time'];
        }
        if (msg.includes('user') || msg.includes('用户')) {
            return errorMap['user'];
        }
        if (msg.includes('system') || msg.includes('系统')) {
            return errorMap['system'];
        }
    }
    
    // 默认返回
    return {
        description: `未知错误类型: ${code}`,
        suggestion: '继续尝试其他座位或联系技术支持',
        duration: 4000
    };
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
                        sendedIdList[seatId] = true;
                    }
                    // 检查是否站票超过ID最大值
                    if (seatElementIdx && seatElementIdx > MAX_SEAT_ID && block.toString().startsWith("1")) {
                        return;
                    }
                    
                    if (!isSuccess) {
                        if (chooseable == "0") {
                            showToast(`🎯 发现空座！<br>区块: ${block} 座位: ${seatId}<br>序号: ${seatElementIdx}`, 'success', 2000);
                            addSeatToQueue(seat);
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
    await sleep(700);
    let i = 0;
    let requestCount = 0;
    let totalRequests = 0; // 总请求数
    let progressInterval = PROGRESS_INTERVAL; // 使用配置的间隔
    let startTime = Date.now(); // 搜索开始时间
    let foundSeatsCount = 0; // 发现的座位总数
    
    await sleep(1000);
    toastInfo(`🚀 开始搜索座位<br>目标区块: [${blockSelect.join(', ')}]<br>用户ID: ${USERID}<br>📈 每${progressInterval}次请求显示进度<br>💡 刷新页面可停止搜索`);
    
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
        totalRequests++;
        
        // 每完成一轮搜索所有区块，增加轮次
        if (i === 0 && totalRequests > blockSelect.length) {
            currentRound++;
        }
        
        // 每隔一定数量的请求显示进度
        if (totalRequests % progressInterval === 0) {
            const now = Date.now();
            const elapsed = Math.floor((now - startTime) / 1000); // 已运行秒数
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
            
            let progressMsg = `🔄 搜索进行中...<br>`;
            progressMsg += `📊 已搜索: ${totalRequests} 次<br>`;
            progressMsg += `⏱️ 运行时间: ${timeStr}<br>`;
            
            // 可选：显示搜索速度
            if (PROGRESS_SHOW_SPEED && elapsed > 0) {
                const requestsPerSecond = (totalRequests / elapsed).toFixed(1);
                progressMsg += `🚀 搜索速度: ${requestsPerSecond}/秒<br>`;
            }
            
            progressMsg += `🎯 当前区块: ${blockSelect[i % blockSelect.length]}<br>`;
            
            // 可选：显示队列状态
            if (PROGRESS_SHOW_QUEUE) {
                if (secondSeatQueue.length > 0) {
                    progressMsg += `💭 二次队列: ${secondSeatQueue.length} 个座位`;
                } else {
                    progressMsg += `✨ 持续搜索空座位中...`;
                }
            }
            
            // 如果发现了座位，显示统计
            const currentFoundSeats = Object.keys(sendedIdList).length;
            if (currentFoundSeats > foundSeatsCount) {
                foundSeatsCount = currentFoundSeats;
                progressMsg += `<br>🎯 已发现座位: ${foundSeatsCount} 个`;
            }
            
            showToast(progressMsg, 'info', 4000);
        }
        
        await sleep(50);
        if (requestCount % 8 === 0) {
            requestCount = 0;
            await sleep(REFRESH_INTERVAL);
        }
    }
    
    // 搜索结束统计
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;
    const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
    
    toastSuccess(`🎉 搜索完成！<br>总请求: ${totalRequests} 次<br>总耗时: ${timeStr}<br>发现座位: ${Object.keys(sendedIdList).length} 个`, 6000);
}

async function trySecondSeat(){
    // 这个函数现在主要用于兼容性，实际处理由secondSeatProcessor完成
    if (seatQueue.length == 0 && secondSeatQueue.length > 0 && !isSuccess) {
        console.log(`[兼容性] trySecondSeat被调用，但实际处理由secondSeatProcessor完成`);
        console.log(`[兼容性] 当前二次队列长度: ${secondSeatQueue.length}`);
    }
}

// 独立的二次座位处理器 - 并行运行
async function secondSeatProcessor() {
    console.log('[二次处理器] 启动二次座位处理器');
    let attemptCount = 0;
    
    while (!isSuccess) {
        // 智能调度：空座位优先级更高
        if (seatQueue.length > 0) {
            // 有空座位时暂停二次处理，让主线程专注处理空座位
            await sleep(100);
            continue;
        }
        
        if (secondSeatQueue.length > 0) {
            let seat = secondSeatQueue.shift();
            if (seat && !isSuccess) {
                attemptCount++;
                console.log(`[二次处理器] 第${attemptCount}次二次尝试: ${seat.block}-${seat.id}`);
                
                // 每10次尝试显示一次提示，避免Toast过多
                if (attemptCount % 10 === 1 || secondSeatQueue.length === 0) {
                    toastWarning(`🔄 二次尝试 #${attemptCount}<br>区块: ${seat.block} 座位: ${seat.id}<br>队列剩余: ${secondSeatQueue.length}`, 2000);
                }
                
                sendSeatLockRequest(seat.block, seat.id, true);
                
                // 动态调整等待时间：队列越长等待越短
                const waitTime = secondSeatQueue.length > 5 ? 500 : 800;
                await sleep(waitTime);
            }
        } else {
            // 没有二次座位时，等待更长时间
            await sleep(1000);
        }
    }
    
    console.log(`[二次处理器] 处理器结束，总共尝试了 ${attemptCount} 次二次座位`);
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
    selectRange(1);
    await sleep(1000);
    
    toastInfo('🚀 启动并行抢票系统<br>🔍 主搜索器：寻找空座位<br>🔄 二次处理器：重试已占用座位', 3000);
    
    // 使用Promise.all并行启动所有任务
    await Promise.all([
        // 主搜索任务
        (async () => {
            try {
                await searchSeat();
            } catch (error) {
                console.error('[主搜索器] 错误:', error);
                toastError(`主搜索器错误: ${error.message}`);
            }
        })(),
        
        // 二次座位处理任务
        (async () => {
            try {
                await secondSeatProcessor();
            } catch (error) {
                console.error('[二次处理器] 错误:', error);
                toastError(`二次处理器错误: ${error.message}`);
            }
        })(),
        
        // 主锁定循环任务
        (async () => {
            try {
                console.log('[主锁定器] 启动主锁定循环');
                while (!isSuccess) {
                    if (seatQueue.length > 0) {
                        let seat = getSeatFromQueue();
                        if (seat && !isSuccess) {
                            console.log(`[主锁定器] 处理空座位: ${seat.block}-${seat.id}`);
                            toastInfo(`🎯 锁定空座位<br>区块: ${seat.block} 座位: ${seat.id}`, 2000);
                            sendSeatLockRequest(seat.block, seat.id, true);
                            popSeatFromQueue();
                            await sleep(200);
                        }
                    } else {
                        await sleep(50); // 没有空座位时短暂等待
                    }
                }
                console.log('[主锁定器] 主锁定循环结束');
            } catch (error) {
                console.error('[主锁定器] 错误:', error);
                toastError(`主锁定器错误: ${error.message}`);
            }
        })()
    ]);
    
    // 接口锁成功的处理一下选座
    toastSuccess(`🎊 抢票成功！<br>正在处理选座和支付...`, 6000);
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

/*--------------------------------- 飞书结构化消息函数 ---------------------------------*/
// 发送结构化数据到飞书
async function sendFeiShuStructuredMsg(webhookUrl, data) {
    if (!webhookUrl) {
        console.log("WEBHOOK_URL未设置");
        return;
    }
    
    const payload = {
        msg_type: 'text',
        content: data
    };

    try {
        // 方案1：使用fetch with no-cors mode
        const response = await fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors', // 绕过CORS限制
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        console.log('飞书结构化消息发送成功 (no-cors模式)');
        return { success: true, mode: 'no-cors' };
    } catch (err) {
        console.warn('no-cors模式发送失败，尝试XMLHttpRequest方式:', err.message);
    }
}

// XMLHttpRequest方式发送
function sendFeiShuWithXHR(webhookUrl, payload) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', webhookUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200 || xhr.status === 0) {
                    console.log('飞书结构化消息发送成功 (XMLHttpRequest)');
                    resolve({ success: true, mode: 'xhr' });
                } else {
                    reject(new Error(`XMLHttpRequest失败: ${xhr.status}`));
                }
            }
        };
        
        xhr.onerror = function() {
            reject(new Error('XMLHttpRequest网络错误'));
        };
        
        xhr.send(JSON.stringify(payload));
    });
}

// JSONP方式发送 (如果webhook支持的话)
function sendFeiShuWithJSONP(webhookUrl, payload) {
    return new Promise((resolve, reject) => {
        // 创建一个临时的全局回调函数
        const callbackName = 'feiShuCallback_' + Date.now();
        window[callbackName] = function(response) {
            console.log('飞书结构化消息发送成功 (JSONP)');
            delete window[callbackName];
            document.head.removeChild(script);
            resolve({ success: true, mode: 'jsonp', response: response });
        };
        
        // 创建script标签
        const script = document.createElement('script');
        const params = new URLSearchParams({
            callback: callbackName,
            data: JSON.stringify(payload)
        });
        script.src = `${webhookUrl}?${params.toString()}`;
        
        script.onerror = function() {
            delete window[callbackName];
            document.head.removeChild(script);
            reject(new Error('JSONP请求失败'));
        };
        
        // 设置超时
        setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                document.head.removeChild(script);
                reject(new Error('JSONP请求超时'));
            }
        }, 10000);
        
        document.head.appendChild(script);
    });
}

// 备用方案：将数据存储到控制台和localStorage
function logStructuredData(data) {
    const timestamp = new Date().toLocaleString();
    const logData = {
        timestamp: timestamp,
        ...data
    };
    
    console.log('🚀 飞书结构化数据 (备用记录):', JSON.stringify(logData, null, 2));
    
    // 存储到localStorage作为备份
    try {
        const existingLogs = JSON.parse(localStorage.getItem('feishu_backup_logs') || '[]');
        existingLogs.push(logData);
        // 只保留最近的50条记录
        if (existingLogs.length > 50) {
            existingLogs.splice(0, existingLogs.length - 50);
        }
        localStorage.setItem('feishu_backup_logs', JSON.stringify(existingLogs));
    } catch (e) {
        console.warn('无法存储备份日志:', e.message);
    }
}
//#endregion