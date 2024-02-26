import { CrossChainMessenger, MessageStatus } from "@eth-optimism/sdk";
import env from "../../utils/env";
import network from "../../utils/network";

async function main() {
  const networkName = env.network();
  const [l1Signer, l2Signer] = network
    .multichain(["eth", "lisk"], networkName)
    .getSigners(env.privateKey(), { forking: false });

  const txHash = env.string("TX_HASH");

  const crossDomainMessenger = new CrossChainMessenger({
    l1ChainId: network.chainId("eth", networkName),
    l2ChainId: network.chainId("lisk", networkName),
    l1SignerOrProvider: l1Signer,
    l2SignerOrProvider: l2Signer,
  });

  const status = await crossDomainMessenger.getMessageStatus(txHash);

  if (status !== MessageStatus.READY_FOR_RELAY) {
    throw new Error(`Invalid tx status: ${status}`);
  }

  console.log("Depositing to L2");
  await crossDomainMessenger.finalizeMessage(txHash);
  console.log("Deposit successfully finalized!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
