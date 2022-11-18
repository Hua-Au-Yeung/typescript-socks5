export enum CommandType {
    Connect = 0x01,
    Bind = 0x02,
    UdpAssociate = 0x03
}

export enum AddressType {
    IPv4 = 0x01,
    Domain = 0x03,
    IPv6 = 0x04
}

export enum ClientSocketState {
    connected = 0x00,
    Handshaking = 0x01,
    Authenticate = 0x02,
    CmdProcessing = 0x03,
    DataTransmission = 0x04
}

export enum AuthMethodType {
    NoAuth = 0x00,
    GSSAPI = 0x01,
    Basic = 0x02, // username/password
    // 0x03 - 0x7F IANA assigned
    // 0x80 - 0xFE private methods
    Invalid = 0xFF
}

export enum CommandReplyType {
    Succeeded = 0x00,
    GeneralFailure = 0x01,
    ConnectionDisallowedByRuleset = 0x02,
    NetworkUnreachable = 0x03,
    HostUnreachable = 0x04,
    ConnectionRefused = 0x05,
    TTLExpired = 0x06,
    CommandNotSupported = 0x07,
    AddressTypeNotSupported = 0x08
    // 0x09 - 0xFF not assigned
}
