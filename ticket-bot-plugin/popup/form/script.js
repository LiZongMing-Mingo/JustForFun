import { get_stored_value, store_value } from "../module/storage.js";

window.onclick = function(event) {
    const target = event.target;
    if (target.classList.contains("close")) {
        window.history.back();
    }
}


document.addEventListener('DOMContentLoaded', function  () {
    const form = document.querySelector('form');
    
    // 加载已有配置
    loadExistingConfig();
    
    async function loadExistingConfig() {
        const urlParams = new URLSearchParams(window.location.search);
        const concertId = urlParams.get('id');
        if (concertId) {
            const data = await get_stored_value(concertId);
            if (data) {
                // 填充表单
                if (data['concert-id']) document.getElementById('concert-id').value = data['concert-id'];
                if (data['user-id']) document.getElementById('user-id').value = data['user-id'];
                if (data.date) document.getElementById('date').value = data.date;
                if (data.time) document.getElementById('time').value = data.time;
                if (data.section) document.getElementById('section').value = data.section;
            }
        }
    }

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        form.getElementsByTagName("button")[0].disabled = true;
        
        let data = {};
        const formData = new FormData(form);
        for (const [key, value] of formData.entries()) {
            data[key] = value.trim();
        }
        
        // 验证用户ID格式
        if (!data["user-id"] || data["user-id"].length < 10) {
            alert("请输入有效的用户ID");
            form.getElementsByTagName("button")[0].disabled = false;
            return;
        }
        
        // 验证区块配置
        if (!data["section"]) {
            alert("请输入偏好区块");
            form.getElementsByTagName("button")[0].disabled = false;
            return;
        }
        
        // 验证区块格式并转换
        const sections = data["section"].split(",").map(s => s.trim());
        const validSections = sections.filter(s => /^\d+$/.test(s));
        if (validSections.length === 0) {
            alert("请输入有效的区块号码，例如：25,26");
            form.getElementsByTagName("button")[0].disabled = false;
            return;
        }
        data["section"] = validSections.join(",");
        
        data["platform"] = form.getElementsByTagName("button")[0].id;
        let array = await get_stored_value("autoBooking") || [];
        store_value(data["concert-id"], data);
        
        // 更新数组中的重复项或添加新项
        const existingIndex = array.findIndex(item => item["concert-id"] === data["concert-id"]);
        if (existingIndex >= 0) {
            array[existingIndex] = data;
        } else {
            array.push(data);
        }
        
        store_value("autoBooking", array);
        alert("配置保存成功！");
        window.history.back();
    });
});