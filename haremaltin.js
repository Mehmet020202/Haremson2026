/**
 * Harem Altın Native WebSocket Client (Fixed)
 * Socket.io (Engine.IO v4) protokolü manuel parse edilir.
 */

(function (window) {
    'use strict';

    var WS_URL = 'wss://hrmsocketonly.haremaltin.com/socket.io/?EIO=4&transport=websocket';
    var socket = null;
    var prices = {};
    var pingTimer = null;
    var reconnectDelay = 5000;

    function connect() {
        console.log('[HaremAltin] Bağlanılıyor: ' + WS_URL);
        socket = new WebSocket(WS_URL);

        socket.onopen = function () {
            console.log('[HaremAltin] WebSocket açıldı');
        };

        socket.onmessage = function (event) {
            var msg = event.data;

            // Engine.IO handshake (0)
            if (msg.startsWith('0')) {
                try {
                    var handshake = JSON.parse(msg.substring(1));
                    startPing(handshake.pingInterval || 25000);
                    socket.send('40'); // socket.io connect
                } catch (e) {
                    startPing(25000);
                    socket.send('40');
                }
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

                    if (eventName === 'price_changed') {
                        prices = data;
                        if (typeof window.HaremAltinOnUpdate === 'function') {
                            window.HaremAltinOnUpdate(prices);
                        }
                    }
                } catch (e) {
                    console.warn('[HaremAltin] Parse hatası', e);
                }
            }
        };

        socket.onclose = function () {
            console.warn('[HaremAltin] Bağlantı kapandı, yeniden bağlanılıyor...');
            stopPing();
            setTimeout(connect, reconnectDelay);
        };

        socket.onerror = function (err) {
            console.error('[HaremAltin] WebSocket hatası', err);
            socket.close();
        };
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
        connect: connect
    };

    connect();

})(window);
