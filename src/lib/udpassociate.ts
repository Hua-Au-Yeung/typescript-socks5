import dgram from 'dgram';
import * as net from 'net';
import { inspect } from 'util';
import { CommandReply, UdpAssociateCommand } from './command';
import { AddressType, CommandReplyType } from './constants';
import { DnsCache } from './dnscache';

// TODO local udp socks5 timeout

export class UdpAssociate {
    private localListener: dgram.Socket;
    private mainSocketAddressInfo: {} | net.AddressInfo;
    private localListenerAddressType: AddressType;
    public localListenerAddress: string = '';
    public localListenerPort: number = 0;
    constructor(
        private mainSocket: net.Socket,
    ) {
        this.mainSocketAddressInfo = this.mainSocket.address();
    }

    public generateLocalListener(): void {
        this.localListener = this.mainSocketAddressInfo['family'] == 'IPv4'
            ? dgram.createSocket('udp4')
            : dgram.createSocket('udp6');
        this.localListenerAddressType = this.mainSocketAddressInfo['family'] == 'IPv4'
            ? AddressType.IPv4
            : AddressType.IPv6;

        this.localListener.on('listening', () => {
            this.localListenerAddress = this.localListener.address().address;
            this.localListenerPort = this.localListener.address().port;

            const commandReply: CommandReply = new CommandReply(
                CommandReplyType.Succeeded,
                this.localListenerAddressType,
                this.localListenerAddress,
                this.localListenerPort,
            );
            const replyBuffer: Buffer = commandReply.generateBuffer();
            this.mainSocket.write(replyBuffer);
        });
        // TODO Check if client is valid
        this.localListener.on('message', (msg, clientAddressInfo) => {
            console.log(`UdpAssociate received: ${inspect(msg)} `);
            // console.log(inspect(UdpAssociateCommand.parseCommand(msg)));
            const [status, addressType, host, port, data] = UdpAssociateCommand.parseCommand(msg);
            // TODO status == false
            const remoteHost = addressType == AddressType.Domain ? DnsCache.dnsQuery(host) : host;
            const remotePort = port;

            const udpType: 'udp4' | 'udp6' = addressType == AddressType.IPv4 ? 'udp4' : 'udp6';
            const remoteSocket = dgram.createSocket(udpType);
            remoteSocket.on('message', (msg, RemoteAddressInfo) => {
                const udpAssociateReplyHeader = UdpAssociateCommand.generateCommandReplyHeader(addressType, host, port);
                console.log(`Udp Associate Reply header: ${inspect(udpAssociateReplyHeader)}`);
                // console.log(`Received Remote: ${inspect(msg)}`);
                this.localListener.send(
                    Buffer.concat([udpAssociateReplyHeader, msg]),
                    clientAddressInfo.port,
                    clientAddressInfo.address,
                    (error) => {
                        // TODO
                    },
                );
            });

            remoteSocket.on('close', () => {
                this.mainSocket.end();
                this.localListener.close();
            });

            remoteSocket.on('error', () => {
                this.mainSocket.end();
                this.localListener.close();
            });

            remoteSocket.send(data, remotePort, remoteHost, (error) => {
                if (error) remoteSocket.close();
            });
        });

        this.localListener.on('close', () => {
            this.mainSocket.end();
        });

        this.localListener.on('error', () => {
            this.mainSocket.end();
        });

        this.localListener.bind(0, this.mainSocketAddressInfo['address']);
    }
}
