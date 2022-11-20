// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract FakeNFTMarketplace {
    /// @dev 维护假的 TokenID 与所有者地址的映射关系
    mapping(uint256 => address) public tokens;
    /// @dev 为每个假的NFT设定购买价
    uint256 nftPrice = 0.1 ether;

    /// @dev purchase() 接受ETH并将给定tokenId的所有者标记为调用者地址
    /// @param _tokenId - 要购买的假NFT代币ID
    function purchase(uint256 _tokenId) external payable {
        require(msg.value == nftPrice, "This NFT costs 0.1 ether");
        tokens[_tokenId] = msg.sender;
    }

    /// @dev getPrice() 返回一个NFT的价格
    function getPrice() external view returns (uint256) {
        return nftPrice;
    }

    /// @dev available() 检查给定的tokenId是否已经被售出
    /// @param _tokenId - 要检查的tokenId
    function available(uint256 _tokenId) external view returns (bool) {
        // address(0) = 0x0000000000000000000000000000000000000000
        // address(0) 是 Solidity 中地址的默认值
        if (tokens[_tokenId] == address(0)) {
            return true;
        }
        return false;
    }
}