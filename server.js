import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 8082 })

// 存放連線資訊
const users = new Map();  // key: userID, value: ws
const agents = new Set();

let userCounter = 1; // 自動給使用者 ID

wss.on('connection', (ws) => {
    ws.role = null;
    ws.id = null;

    ws.on('message', (message) => {
        let data;
        try { data = JSON.parse(message); }
        catch { return; }

        // 註冊角色
        if (data.type === 'register') {
            ws.role = data.role; // 'user' 或 'agent'
            if (ws.role === 'user') {
                ws.id = `user${userCounter++}`;
                users.set(ws.id, ws);
                ws.send(JSON.stringify({ type: 'system', msg: `你的 ID 是 ${ws.id}` }));
            }
            if (ws.role === 'agent') agents.add(ws);
            return;
        }

        // 使用者發訊息 → 發給所有管理員
        if (data.type === 'msg' && ws.role === 'user') {
            agents.forEach(agent => {
                if (agent.readyState === WebSocket.OPEN) {
                    agent.send(JSON.stringify({ type: 'msg', msg: data.msg, userID: ws.id }));
                }
            });
        }

        // 管理員回覆 → 發給所有使用者
        if (data.type === 'reply' && ws.role === 'agent') {
            // data.targetID 可指定使用者回覆，若沒給則發給所有使用者
            if (data.targetID) {
                const userWs = users.get(data.targetID);
                if (userWs && userWs.readyState === WebSocket.OPEN) {
                    userWs.send(JSON.stringify({ type: 'reply', msg: data.msg, from: 'agent' }));
                }
            } else {
                users.forEach((userWs) => {
                    if (userWs.readyState === WebSocket.OPEN) {
                        userWs.send(JSON.stringify({ type: 'reply', msg: data.msg, from: 'agent' }));
                    }
                });
            }
        }
    });

    ws.on('close', () => {
        if (ws.role === 'user') users.delete(ws.id);
        if (ws.role === 'agent') agents.delete(ws);
    });
});

console.log("WebSocket 伺服器啟動於 ws://localhost:8082");