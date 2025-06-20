import { ethers } from "ethers";

interface RawEvent {
  data: string;
}

export class BalanceFetcher {
  static parseDistributorAddresses(events: RawEvent[]): string[] {
    const addresses: string[] = [];

    for (const event of events) {
      if (event.data && event.data.length > 138) {
        try {
          // Skip: 0x (2) + offset (64) + length (64) + method selector (8) = 138 chars
          const encodedAddress = "0x" + event.data.substring(138);
          const [distributorAddress] = ethers.AbiCoder.defaultAbiCoder().decode(
            ["address"],
            encodedAddress,
          );
          addresses.push(ethers.getAddress(distributorAddress));
        } catch {
          // Skip events that cannot be parsed
        }
      }
    }

    return addresses;
  }
}
