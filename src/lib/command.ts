import {AddressType, CommandReplyType, CommandType} from "./constants.js";
import ipaddr from 'ipaddr.js';

function parseAddress(chunk: Buffer):[string, number] {
    let address = [], port;
    const addressType = chunk.readUint8(3);

    switch (addressType) {
        case AddressType.IPv4:
            address.push(chunk.readUint8(4).toString());
            address.push(chunk.readUint8(5).toString());
            address.push(chunk.readUint8(6).toString());
            address.push(chunk.readUint8(7).toString());
            port = chunk.readUInt16BE(8);
            return [address.join('.'), port];
        case AddressType.Domain:
            const domainLength: number = chunk.readUint8(4);
            let i:number;
            for(i = 5; i < 5 + domainLength; i++) {
                address.push(String.fromCharCode(chunk.readUint8(i)));
            }
            port = chunk.readUInt16BE(i);
            return [address.join(''), port];
        case AddressType.IPv6:
            let byteArray: number[] = [];
            for(let i = 4; i < 20; i++) {
                byteArray.push(chunk.readUint8(i));
            }
            const ipv6Addr = ipaddr.fromByteArray(byteArray);
            port = chunk.readUInt16BE(20);
            return [ipv6Addr.toString(), port];
        default:
            break;
    }

    return ['', 0];
}

function host2Buffer(chunk: Buffer, host: string): number {
    let nextOffset: number = -1;
    let offset = 4; // all command host started at index of 4
    const addressType = chunk.readUint8(3);

    switch (addressType) {
        case AddressType.IPv4:
            host.split('.').forEach((seg: string) => {
                chunk.writeUint8(Number.parseInt(seg), offset++);
            });
            nextOffset = 8;
            break;
        case AddressType.Domain:
            chunk.writeUint8(host.length, 4);
            offset += 1;
            [...host].forEach((c, i) => {
                chunk.writeUint8(host.charCodeAt(i), offset++);
            });
            nextOffset = 4 + 1 + host.length;
            break;
        case AddressType.IPv6:
            const bytes = ipaddr.parse(host).toByteArray();
            bytes.map((byte) => {
                chunk.writeUint8(byte, offset++);
            });
            nextOffset = 20;
            break;
    }

    return nextOffset;
}

export class Command {
    public version: number;
    public commandType: CommandType;
    public addressType: AddressType;
    public host: string;
    public port: number;

    constructor(chunk: Buffer) {
        // console.log(inspect(chunk));
        this.version = chunk.readUint8(0);
        this.commandType = chunk.readUint8(1) as CommandType;
        this.addressType = chunk.readUint8(3) as AddressType;

        [this.host, this.port] = parseAddress(chunk);
    }
}

export class UdpAssociateCommand {
    public static parseCommand(chunk: Buffer): [boolean, AddressType, string, number, Buffer] {
        // TODO check if data is valid
        const rsv: number = chunk.readUInt16BE(0);
        const frag: number = chunk.readUint8(2);
        const addressType: AddressType = chunk.readUint8(3) as AddressType;
        const [host, port] = parseAddress(chunk);
        const dataLength = chunk.length - 6 -
            (addressType == AddressType.IPv4 ? 4 : (AddressType.IPv6 ? 16 : host.length));
        const dataStartIndex: number = addressType == AddressType.IPv4 ? 10 : (AddressType.IPv6 ? 22 : (6 + host.length));

        let data = Buffer.alloc(dataLength);
        chunk.copy(data, 0, dataStartIndex);

        return [true, addressType, host, port, data];
    }

    public static generateCommandReplyHeader(addressType: AddressType, address: string, port: number): Buffer {
        const replyBufferLength = 6
            + (addressType == AddressType.IPv4 ? 4 : (AddressType.IPv6 ? 16 : address.length));
        let reply = Buffer.alloc(replyBufferLength);
        reply.writeUInt16BE(0, 0);
        reply.writeUint8(0, 2);
        reply.writeUint8(addressType, 3);
        const nextOffset: number = host2Buffer(reply, address);
        reply.writeUInt16BE(port, nextOffset);

        return reply;
    }
}

export class CommandReply {
    private bufferLength:number = -1;
    constructor(
        private commandReplyType: CommandReplyType,
        private addressType: AddressType,
        private host: string,
        private port: number
    ) {
        switch (this.addressType) {
            case AddressType.IPv4:
                this.bufferLength = 10;
                break;
            case AddressType.Domain:
                this.bufferLength = 7 + this.host.length;
                break;
            case AddressType.IPv6:
                this.bufferLength = 22;
                break;
        }
    }

    public generateBuffer(): Buffer {
        const chunk = Buffer.alloc(this.bufferLength);
        chunk.writeUint8(5, 0);
        chunk.writeUint8(this.commandReplyType.valueOf(), 1);
        chunk.writeUint8(0, 2);
        chunk.writeUint8(this.addressType.valueOf(), 3);
        const nextOffset: number = host2Buffer(chunk, this.host);
        chunk.writeUInt16BE(this.port, nextOffset);

        return chunk;
    }
}
