import { NetworkName } from "../network";
import { LiskContractAddresses, CommonOptions } from "./types";

const LiskSepoliaAddresses: LiskContractAddresses = {
  L1CrossDomainMessenger: "0x857824E6234f7733ecA4e9A76804fd1afa1A3A2C",
  L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
};

export default function addresses(
  networkName: NetworkName,
  options: CommonOptions = {}
) {
  switch (networkName) {
    case "sepolia":
      return { ...LiskSepoliaAddresses, ...options.customAddresses };
    default:
      throw new Error(`Network "${networkName}" is not supported`);
  }
}
