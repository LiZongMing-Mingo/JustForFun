// background.js - 后台脚本处理飞书消息发送
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'sendFeiShuMsg') {
        const { webhook_url, data } = request;
        
        if (!webhook_url) {
            sendResponse({ success: false, error: 'WEBHOOK_URL未设置' });
            return;
        }

        const payload = {
            msg_type: 'text',
            content: data
        };

        fetch(webhook_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
        })
        .then(json => {
            console.log('飞书发送结果:', json);
            sendResponse({ 
                success: true, 
                data: json,
                code: json.code || 0
            });
        })
        .catch(err => {
            console.error('飞书发送错误:', err);
            sendResponse({ 
                success: false, 
                error: err.message 
            });
        });

        // 返回true表示异步响应
        return true;
    }
}); 