import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { DataCipher } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("DataCipherSepolia", function () {
  let signers: Signers;
  let dataCipherContract: DataCipher;
  let dataCipherContractAddress: string;

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const dataCipherDeployment = await deployments.get("DataCipher");
      dataCipherContractAddress = dataCipherDeployment.address;
      dataCipherContract = await ethers.getContractAt("DataCipher", dataCipherDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  it("creates a database and stores an encrypted entry", async function () {
    this.timeout(4 * 60000);

    const databaseId = await dataCipherContract.databaseCount();
    const databaseKey = ethers.Wallet.createRandom().address;

    const encryptedKey = await fhevm
      .createEncryptedInput(dataCipherContractAddress, databaseKey)
      .addAddress(databaseKey)
      .encrypt();

    let tx = await dataCipherContract
      .connect(signers.alice)
      .createDatabase("Sepolia", encryptedKey.handles[0], encryptedKey.inputProof);
    await tx.wait();

    const encryptedKeyOnchain = await dataCipherContract.getDatabaseKey(databaseId);
    const clearKey = await fhevm.userDecryptEaddress(
      FhevmType.eaddress,
      encryptedKeyOnchain,
      dataCipherContractAddress,
      signers.alice,
    );
    expect(ethers.getAddress(clearKey)).to.eq(databaseKey);

    const value = 5;
    const encryptedInput = await fhevm
      .createEncryptedInput(dataCipherContractAddress, databaseKey)
      .addAddress(databaseKey)
      .add32(value)
      .encrypt();

    tx = await dataCipherContract
      .connect(signers.alice)
      .addEntry(databaseId, encryptedInput.handles[1], encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    const encryptedEntries = await dataCipherContract.getEntries(databaseId);
    expect(encryptedEntries.length).to.eq(1);

    const clearValue = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedEntries[0],
      dataCipherContractAddress,
      signers.alice,
    );
    expect(clearValue).to.eq(value);
  });
});
