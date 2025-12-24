import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedDataCipher = await deploy("DataCipher", {
    from: deployer,
    log: true,
  });

  console.log(`DataCipher contract: `, deployedDataCipher.address);
};
export default func;
func.id = "deploy_dataCipher"; // id required to prevent reexecution
func.tags = ["DataCipher"];
