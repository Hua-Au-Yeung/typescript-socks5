import {Socks5Server} from "./lib/server.js";

process.on('uncaughtException', function (err) {
    console.error(err);
});

const server = new Socks5Server(2211, '127.0.0.1');