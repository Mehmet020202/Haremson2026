/**
 * Harem Altın Native WebSocket Client (FIXED)
 * Sunucudan veri isteme özelliği eklendi
 */

(function (window) {
    'use strict';

    var WS_URL = 'wss://hrmsocketonly.haremaltin.com/socket.io/?EIO=4&transport=websocket';
    var socket = null;
    var prices = {};
    var pingTimer = null;
    var reconnectDelay = 5000;
    var isConnected = false;

    function connect() {
        console.log('[HaremAltin] Bağlanılıyor...');
        socket = new WebSocket(WS_URL);

        socket.onopen = function () {
            console.log('[HaremAltin] ✅ WebSocket açıldı');
        };

        socket.onmessage = function (event) {
            var msg = event.data;
            console.log('[HaremAltin] 📨 Mesaj geldi:', msg);

            // Engine.IO handshake (0)
            if (msg.startsWith('0')) {
                try {
                    var handshake = JSON.parse(msg.substring(1));
                    startPing(handshake.pingInterval || 25000);
                    
                    // Socket.io connect gönder
                    socket.send('40');
                    console.log('[HaremAltin] 📤 Socket.io connect gönderildi (40)');
                } catch (e) {
                    startPing(25000);
                    socket.send('40');
                }
                return;
            }

            // Socket.io connected (40 yanıtı)
            if (msg === '40') {
                isConnected = true;
                console.log('[HaremAltin] ✅ Socket.io bağlantısı kuruldu!');
                
                // 🔥 BURAYI EKLEDİK: İlk veriyi iste!
                requestInitialData();
                return;
            }

            // Ping (2) -> Pong (3)
            if (msg === '2') {
                socket.send('3');
                return;
            }

            // Socket.io event (42)
            if (msg.startsWith('42')) {
                try {
                    var payload = JSON.parse(msg.substring(2));
                    var eventName = payload[0];
                    var data = payload[1];

                    console.log('[HaremAltin] 🎯 Event:', eventName, data);

                    // Tüm eventleri yakala
                    if (eventName === 'price_changed' || 
                        eventName === 'prices' || 
                        eventName === 'initial_data' ||
                        eventName === 'data') {
                        
                        prices = data;
                        console.log('[HaremAltin] 💰 Fiyatlar güncellendi:', prices);
                        
                        if (typeof window.HaremAltinOnUpdate === 'function') {
                            window.HaremAltinOnUpdate(prices);
                        }
                    }
                } catch (e) {
                    console.error('[HaremAltin] ❌ Parse hatası:', e);
                }
            }
        };

        socket.onclose = function () {
            console.warn('[HaremAltin] ⚠️ Bağlantı kapandı, yeniden bağlanılıyor...');
            isConnected = false;
            stopPing();
            setTimeout(connect, reconnectDelay);
        };

        socket.onerror = function (err) {
            console.error('[HaremAltin] ❌ WebSocket hatası:', err);
            socket.close();
        };
    }

    // 🔥 YENİ FONKSİYON: Sunucudan veri iste
    function requestInitialData() {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.warn('[HaremAltin] ⚠️ Socket açık değil, veri istenemedi');
            return;
        }

        // Farklı veri isteme yöntemlerini dene
        var requests = [
            '42["get_prices"]',      // Olası event 1
            '42["prices"]',          // Olası event 2
            '42["request_prices"]',  // Olası event 3
            '42["initial_data"]'     // Olası event 4
        ];

        requests.forEach(function(req) {
            console.log('[HaremAltin] 📤 Veri isteniyor:', req);
            socket.send(req);
        });

        // Eğer hiçbir event işe yaramazsa, 5 saniye sonra tekrar dene
        setTimeout(function() {
            if (Object.keys(prices).length === 0) {
                console.warn('[HaremAltin] ⚠️ Hala veri gelmedi, tekrar deneniyor...');
                requestInitialData();
            }
        }, 5000);
    }

    function startPing(interval) {
        stopPing();
        pingTimer = setInterval(function () {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send('2');
            }
        }, interval);
    }

    function stopPing() {
        if (pingTimer) {
            clearInterval(pingTimer);
            pingTimer = null;
        }
    }

    window.HaremAltin = {
        getPrices: function () { return prices; },
        connect: connect,
        isConnected: function() { return isConnected; }
    };

    connect();

})(window);
