import * as net from 'net';
import {inspect} from "util";
import {DnsCache} from "./dnscache.js";
import {Command, CommandReply} from './command.js'
import {AddressType, AuthMethodType, ClientSocketState, CommandReplyType, CommandType} from "./constants.js";

export class Socks5Server/* extends EventEmitter*/{
    private tcpServer: net.Server;
    private acceptAuthMethod: AuthMethodType;

    constructor(port: number, hostname: string) {
        /*super();*/
        this.acceptAuthMethod = AuthMethodType.NoAuth; // only NoAuth

        this.tcpServer = net.createServer((clientSocket:net.Socket) => {
            let clientStats = ClientSocketState.connected;
            console.log(`Connect from ${clientSocket.remoteAddress}:${clientSocket.remotePort}`);

            clientSocket.on('data', (data) => {
                console.log(`client on data: ${inspect(data)}`);
                switch (clientStats) {
                    case ClientSocketState.connected:
                        clientStats = ClientSocketState.Handshaking;
                        if (!this.handshake(clientSocket, data)) {
                            clientSocket.end();
                        } else {
                            if (this.acceptAuthMethod == AuthMethodType.NoAuth) {
                                clientStats = ClientSocketState.CmdProcessing;
                            } else {
                                // TODO other AuthMethodType
                            }
                        }
                        break;
                    case ClientSocketState.CmdProcessing:
                        if (!this.processCmd(clientSocket, data)) {
                            clientSocket.end();
                        } else {
                            clientStats = ClientSocketState.DataTransmission;
                        }
                        break;
                    case ClientSocketState.DataTransmission:
                        console.log(`Data transfer begins`);
                        // remove data event listeners
                        // clientSocket.removeAllListeners('data');
                        break;
                    default:
                        console.log(`UnHandle data: ${inspect(data)}`);
                        break;
                }
            });

            clientSocket.on('close', () => {
                console.log(`client ${clientSocket.remoteAddress}:${clientSocket.remotePort} closed`);
            });

            clientSocket.on('error', (error:Error) => {
                switch (error.message) {
                    case 'read ECONNRESET':
                        break;
                    default:
                        console.error(error.message);
                        break;
                }
            });
        });

        this.tcpServer.listen(port, hostname);

        this.tcpServer.on('listening', () => {
            console.log('Socks5 server started...');
        });
    }

    private handshake(socket: net.Socket, chunk: Buffer): boolean {
        const version: number = chunk.readUint8(0);
        const numOfMethods = chunk.readUint8(1);
        const methods = [];

        for(let i = 0; i < numOfMethods; i++) {
            methods.push(chunk.readUint8(i + 2));
        }

        // console.log(`client version ${version} number of methods ${numOfMethods}`);
        // console.log(`client accept methods: ${inspect(methods)}`);

        const buffer = Buffer.alloc(2);
        buffer.writeUint8(5, 0);
        if(methods.indexOf(this.acceptAuthMethod) !== -1) {
            buffer.writeUint8(this.acceptAuthMethod, 1);
            socket.write(buffer);
            return true;
        } else {
            buffer.writeUint8(0xFF, 1);
            socket.write(buffer);
            return false;
        }
    }

    private processCmd(socket: net.Socket, chunk: Buffer): Boolean {
        const cmd = new Command(chunk);
        let readyToConnectRemoteHost:string = cmd.host,
            readyToConnectRemotePort:number = cmd.port;
        let commandReply: CommandReply;
        let isCommandSucceeded: boolean = true;

        // Non-existent command type
        if (!Object.values(CommandType).includes(cmd.commandType)) {
            console.error(`Error command type [${cmd.commandType}] from ${socket.remoteAddress}:${socket.remotePort}`);
            socket.end();
        }

        switch (cmd.addressType) {
            case AddressType.Domain:
                const dnsResolveRecord = DnsCache.dnsQuery(cmd.host);
                // resole domain name & no record found
                if (!dnsResolveRecord) {
                    commandReply = new CommandReply(
                        CommandReplyType.HostUnreachable,
                        AddressType.Domain, cmd.host, cmd.port
                    );
                    isCommandSucceeded = false;
                } else {
                    readyToConnectRemoteHost = dnsResolveRecord;
                }
                break;
            case AddressType.IPv4:
                break;
            case AddressType.IPv6:
                break;
            default:
                commandReply = new CommandReply(
                    CommandReplyType.AddressTypeNotSupported,
                    cmd.addressType, cmd.host, cmd.port
                );
                isCommandSucceeded = false;
        }

        if (isCommandSucceeded) {
            switch (cmd.commandType) {
                case CommandType.Connect:
                    // remove data event listeners
                    socket.removeAllListeners('data');
                    const remoteSocket: net.Socket = new net.Socket();
                    remoteSocket.connect(readyToConnectRemotePort, readyToConnectRemoteHost, () => {
                        const commandReply2: CommandReply = new CommandReply(
                            CommandReplyType.Succeeded,
                            cmd.addressType, readyToConnectRemoteHost, readyToConnectRemotePort
                        );
                        const replyBuffer: Buffer = commandReply2.generateBuffer();
                        socket.write(replyBuffer);
                        socket.pipe(remoteSocket);
                        remoteSocket.pipe(socket);
                    });
                    remoteSocket.on('error', (error: Error) => {
                        console.error(`RemoteSocket Error:${inspect(error)}`);
                    });

                    break;
                case CommandType.Bind:
                // TODO
                case CommandType.UdpAssociate:
                // TODO
                default:
                    commandReply = new CommandReply(
                        CommandReplyType.CommandNotSupported,
                        cmd.addressType, cmd.host, cmd.port
                    );
                    isCommandSucceeded = false;
            }
        }

        // @ts-ignore
        if (commandReply != undefined) {
            const replyBuffer: Buffer = commandReply.generateBuffer();
            console.log(inspect(replyBuffer));
            socket.write(replyBuffer);
        }
        return isCommandSucceeded;
    }
}
