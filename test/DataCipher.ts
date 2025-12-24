import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { DataCipher, DataCipher__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("DataCipher")) as DataCipher__factory;
  const dataCipherContract = (await factory.deploy()) as DataCipher;
  const dataCipherContractAddress = await dataCipherContract.getAddress();

  return { dataCipherContract, dataCipherContractAddress };
}

describe("DataCipher", function () {
  let signers: Signers;
  let dataCipherContract: DataCipher;
  let dataCipherContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ dataCipherContract, dataCipherContractAddress } = await deployFixture());
  });

  it("creates a database and decrypts its key", async function () {
    const databaseKey = ethers.Wallet.createRandom().address;
    const encryptedKey = await fhevm
      .createEncryptedInput(dataCipherContractAddress, databaseKey)
      .addAddress(databaseKey)
      .encrypt();

    const tx = await dataCipherContract
      .connect(signers.alice)
      .createDatabase("Alpha", encryptedKey.handles[0], encryptedKey.inputProof);
    await tx.wait();

    const dbInfo = await dataCipherContract.getDatabase(0);
    expect(dbInfo[0]).to.eq("Alpha");
    expect(dbInfo[1]).to.eq(signers.alice.address);
    expect(dbInfo[2]).to.eq(0n);

    const encryptedKeyOnchain = await dataCipherContract.getDatabaseKey(0);
    const clearKey = await fhevm.userDecryptEaddress(
      FhevmType.eaddress,
      encryptedKeyOnchain,
      dataCipherContractAddress,
      signers.alice,
    );
    expect(ethers.getAddress(clearKey)).to.eq(databaseKey);
  });

  it("stores and decrypts an entry with the correct key", async function () {
    const databaseKey = ethers.Wallet.createRandom().address;
    const encryptedKey = await fhevm
      .createEncryptedInput(dataCipherContractAddress, databaseKey)
      .addAddress(databaseKey)
      .encrypt();

    let tx = await dataCipherContract
      .connect(signers.alice)
      .createDatabase("Notes", encryptedKey.handles[0], encryptedKey.inputProof);
    await tx.wait();

    const value = 42;
    const encryptedInput = await fhevm
      .createEncryptedInput(dataCipherContractAddress, databaseKey)
      .addAddress(databaseKey)
      .add32(value)
      .encrypt();

    tx = await dataCipherContract
      .connect(signers.alice)
      .addEntry(0, encryptedInput.handles[1], encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    const encryptedEntries = await dataCipherContract.getEntries(0);
    expect(encryptedEntries.length).to.eq(1);

    const clearValue = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedEntries[0],
      dataCipherContractAddress,
      signers.alice,
    );
    expect(clearValue).to.eq(value);
  });

  it("stores zero when the key does not match", async function () {
    const databaseKey = ethers.Wallet.createRandom().address;
    const encryptedKey = await fhevm
      .createEncryptedInput(dataCipherContractAddress, databaseKey)
      .addAddress(databaseKey)
      .encrypt();

    let tx = await dataCipherContract
      .connect(signers.alice)
      .createDatabase("Mismatch", encryptedKey.handles[0], encryptedKey.inputProof);
    await tx.wait();

    const wrongKey = ethers.Wallet.createRandom().address;
    const encryptedInput = await fhevm
      .createEncryptedInput(dataCipherContractAddress, wrongKey)
      .addAddress(wrongKey)
      .add32(77)
      .encrypt();

    tx = await dataCipherContract
      .connect(signers.alice)
      .addEntry(0, encryptedInput.handles[1], encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    const encryptedEntries = await dataCipherContract.getEntries(0);
    const clearValue = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedEntries[0],
      dataCipherContractAddress,
      signers.alice,
    );
    expect(clearValue).to.eq(0);
  });
});
