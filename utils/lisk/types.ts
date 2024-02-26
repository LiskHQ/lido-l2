export type LiskContractNames =
  | "L1CrossDomainMessenger"
  | "L2CrossDomainMessenger";

export type LiskContractAddresses = Record<LiskContractNames, string>;
export type CustomLiskContractAddresses = Partial<LiskContractAddresses>;
export interface CommonOptions {
  customAddresses?: CustomLiskContractAddresses;
}
