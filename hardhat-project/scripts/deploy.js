const { ethers } = require("hardhat");
const { ZERODOT618_NFT_CONTRACT_ADDRESS } = require("../constants");

async function main() {
  // 首先部署 FakeNFTMarketplace 合约
  const FakeNFTMarketplace = await ethers.getContractFactory(
    "FakeNFTMarketplace"
  );
  const fakeNftMarketplace = await FakeNFTMarketplace.deploy();
  await fakeNftMarketplace.deployed();

  console.log("FakeNFTMarketplace deployed to: ", fakeNftMarketplace.address);

  // 再部署 ZeroDot618DAO 合约
  const ZeroDot618DAO = await ethers.getContractFactory("ZeroDot618DAO");
  const zerodot618DAO = await ZeroDot618DAO.deploy(
    fakeNftMarketplace.address,
    ZERODOT618_NFT_CONTRACT_ADDRESS,
    {
      // This assumes your account has at least 1 ETH in it's account
      // Change this value as you want
      value: ethers.utils.parseEther("0.3"),
    }
  );
  await zerodot618DAO.deployed();

  console.log("ZeroDot618DAO deployed to: ", zerodot618DAO.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });