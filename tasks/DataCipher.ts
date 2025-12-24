import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:db-address", "Prints the DataCipher address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const dataCipher = await deployments.get("DataCipher");
  console.log("DataCipher address is " + dataCipher.address);
});

task("task:db-info", "Prints database metadata")
  .addParam("id", "Database id")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const dataCipherDeployment = await deployments.get("DataCipher");
    const dataCipherContract = await ethers.getContractAt("DataCipher", dataCipherDeployment.address);

    const databaseId = BigInt(taskArguments.id);
    const dbInfo = await dataCipherContract.getDatabase(databaseId);
    console.log(`Database ${databaseId.toString()}: name=${dbInfo[0]} owner=${dbInfo[1]} entries=${dbInfo[2]}`);
  });

task("task:db-create", "Creates a new encrypted database")
  .addParam("name", "Database name")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const dataCipherDeployment = await deployments.get("DataCipher");
    const dataCipherContract = await ethers.getContractAt("DataCipher", dataCipherDeployment.address);
    const signers = await ethers.getSigners();

    const databaseKey = ethers.Wallet.createRandom().address;
    const encryptedInput = await fhevm
      .createEncryptedInput(dataCipherDeployment.address, databaseKey)
      .addAddress(databaseKey)
      .encrypt();

    const databaseId = await dataCipherContract.databaseCount();
    const tx = await dataCipherContract
      .connect(signers[0])
      .createDatabase(taskArguments.name, encryptedInput.handles[0], encryptedInput.inputProof);

    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
    console.log(`Database created: id=${databaseId.toString()} key=${databaseKey}`);
  });

task("task:db-decrypt-key", "Decrypts the encrypted database key")
  .addParam("id", "Database id")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const dataCipherDeployment = await deployments.get("DataCipher");
    const dataCipherContract = await ethers.getContractAt("DataCipher", dataCipherDeployment.address);
    const signers = await ethers.getSigners();

    const databaseId = BigInt(taskArguments.id);
    const encryptedKey = await dataCipherContract.getDatabaseKey(databaseId);

    const clearKey = await fhevm.userDecryptEaddress(
      FhevmType.eaddress,
      encryptedKey,
      dataCipherDeployment.address,
      signers[0],
    );

    console.log(`Database ${databaseId.toString()} key: ${clearKey}`);
  });

task("task:db-add-entry", "Encrypts and stores a number in the database")
  .addParam("id", "Database id")
  .addParam("key", "Decrypted database key (address)")
  .addParam("value", "Numeric value to encrypt")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const value = parseInt(taskArguments.value);
    if (!Number.isInteger(value)) {
      throw new Error(`Argument --value is not an integer`);
    }

    const key = taskArguments.key;
    if (!ethers.isAddress(key)) {
      throw new Error(`Argument --key is not a valid address`);
    }

    const dataCipherDeployment = await deployments.get("DataCipher");
    const dataCipherContract = await ethers.getContractAt("DataCipher", dataCipherDeployment.address);
    const signers = await ethers.getSigners();

    const databaseId = BigInt(taskArguments.id);
    const encryptedInput = await fhevm
      .createEncryptedInput(dataCipherDeployment.address, key)
      .addAddress(key)
      .add32(value)
      .encrypt();

    const tx = await dataCipherContract
      .connect(signers[0])
      .addEntry(databaseId, encryptedInput.handles[1], encryptedInput.handles[0], encryptedInput.inputProof);

    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
    console.log(`Stored value ${value} in database ${databaseId.toString()}`);
  });

task("task:db-entries", "Decrypts all entries in a database")
  .addParam("id", "Database id")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const dataCipherDeployment = await deployments.get("DataCipher");
    const dataCipherContract = await ethers.getContractAt("DataCipher", dataCipherDeployment.address);
    const signers = await ethers.getSigners();

    const databaseId = BigInt(taskArguments.id);
    const encryptedEntries = await dataCipherContract.getEntries(databaseId);

    if (encryptedEntries.length === 0) {
      console.log(`Database ${databaseId.toString()} has no entries`);
      return;
    }

    console.log(`Database ${databaseId.toString()} entries:`);
    for (let i = 0; i < encryptedEntries.length; i += 1) {
      const clearValue = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedEntries[i],
        dataCipherDeployment.address,
        signers[0],
      );
      console.log(`  [${i}] ${clearValue}`);
    }
  });
