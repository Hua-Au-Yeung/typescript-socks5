// @ts-ignore
import dnsSync from 'dns-sync';
import MemCache from 'mem-cache';

export class DnsCache {
    private static mcache: MemCache;

    // query and cache dns lookup record for 60 * 10 seconds
    public static dnsQuery(domain: string): string {
        if (!DnsCache.mcache) {
            DnsCache.mcache = new MemCache();
        }
        const key = `D:${domain}`;
        let value = DnsCache.mcache.get(key);
        if (!value) {
            value = dnsSync.resolve(domain);
        }

        if (value == null) {
            return '';
        } else {
            DnsCache.mcache.set(key, value, 60 * 10);
            return value;
        }
    }
}
