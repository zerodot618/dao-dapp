// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * FakeNFTMarketplace 合约接口
 */
interface IFakeNFTMarketplace {
    /// @dev getPrice() 从 FakeNFTMarketplace 合约获取一个NFT的价格
    /// @return 返回一个NFT的价格，以 Wei 为单位
    function getPrice() external view returns (uint256);

    /// @dev available() 返回给定的_tokenId是否已经被购买
    /// @return 返回一个布尔值--如果可购买则为真，如果不可购买则为假
    function available(uint256 _tokenId) external view returns (bool);

    /// @dev purchase() 从 FakeNFTMarketplace 购买一个NFT
    /// @param _tokenId - 购买来的 假NFT tokenId
    function purchase(uint256 _tokenId) external payable;
}

/**
 * 只包含两个 ZeroDotNFT 中我们需要的功能
 */
interface IZeroDot618NFT {
    /// @dev balanceOf 返回给定地址所拥有的NFT的数量
    /// @param owner - 获取NFT数量的地址
    /// @return 返回拥有的NFT的数量
    function balanceOf(address owner) external view returns (uint256);

    /// @dev 返回所有者在给定索引上的tokenID
    /// @param owner - 取出NFT TokenID的地址
    /// @param index - 要获取的NFT在自有tokens数组中的索引
    /// @return 返回NFT的TokenID
    function tokenOfOwnerByIndex(address owner, uint256 index)
        external
        view
        returns (uint256);
}

contract ZeroDot618DAO is Ownable {
    // 创建一个名为 Proposal 的结构，包含提案相关信息
    struct Proposal {
        // nftTokenId - 如果提案通过，将从FakeNFTMarketplace购买NFT的tokenID
        uint256 nftTokenId;
        // deadline - 提案截止UNIX时间戳，直到该提案被激活。提案可以在超过期限后执行
        uint256 deadline;
        // yayVotes - 本提案的赞成票数
        uint256 yayVotes;
        // nayVotes - 本提案的反对票数
        uint256 nayVotes;
        // executed - 无论此提案是否已被执行。在超过期限之前不能执行。
        bool executed;
        // voters - 一个ZeroDot618NFT tokenID到 bool 的映射，表明该NFT是否已经被用于投票。
        mapping(uint256 => bool) voters;
    }

    // 创建一个ID到提案的映射
    mapping(uint256 => Proposal) public proposals;
    // 已创建的提案数量
    uint256 public numProposals;

    // 初始化外部合约变量
    IFakeNFTMarketplace nftMarketplace;
    IZeroDot618NFT zeroDot618NFT;

    // 建一个名为 "投票 "的枚举，包含投票的可能选项
    enum Vote {
        YAY, // YAY = 0 赞成
        NAY // NAY = 1 反对
    }

    // 创建一个可支付的构造函数，初始化 FakeNFTMarketplace and ZeroDot618NFT 合约实例
    // 该款项允许该构造器在部署时接受ETH存款
    constructor(address _nftMarketplace, address _zeroDot618NFT) payable {
        nftMarketplace = IFakeNFTMarketplace(_nftMarketplace);
        zeroDot618NFT = IZeroDot618NFT(_zeroDot618NFT);
    }

    // 创建一个修改器，只允许一个函数被由拥有至少1个ZeroDot618NFT的人调用
    modifier nftHolderOnly() {
        require(zeroDot618NFT.balanceOf(msg.sender) > 0, "NOT_A_DAO_MEMBER");
        _;
    }

    // 创建一个修改器，该修改器仅允许在给定建议的截止日期尚未超过时调用函数
    modifier activeProposalOnly(uint256 proposalIndex) {
        require(
            proposals[proposalIndex].deadline > block.timestamp,
            "DEADLINE_EXCEEDED"
        );
        _;
    }

    // 创建一个修改器，该修改器仅允许在给定提案的截止日期已过且提案尚未执行时调用函数
    modifier inactiveProposalOnly(uint256 proposalIndex) {
        require(
            proposals[proposalIndex].deadline <= block.timestamp,
            "DEADLINE_NOT_EXCEEDED"
        );
        require(
            proposals[proposalIndex].executed == false,
            "PROPOSAL_ALREADY_EXECUTED"
        );
        _;
    }

    /// @dev createProposal 允许 ZeroDot618NFT 持有人在 DAO 中创建新提案
    /// @param _nftTokenId - 如果该提案通过，将从FakeNFTMarketplace购买NFT的tokenID
    /// @return 返回新创建的提案的提案索引
    function createProposal(uint256 _nftTokenId)
        external
        nftHolderOnly
        returns (uint256)
    {
        require(nftMarketplace.available(_nftTokenId), "NFT_NOT_FOR_SALE");
        Proposal storage proposal = proposals[numProposals];
        proposal.nftTokenId = _nftTokenId;
        // 设置该提案的投票截止时间为（当前时间+5分钟）
        proposal.deadline = block.timestamp + 5 minutes;

        numProposals++;

        return numProposals - 1;
    }

    /// @dev voteOnProposal 允许 ZeroDot618NFT 持有人对一个正在进行的提案进行投票
    /// @param proposalIndex - 在提案阵列中要投票的提案的索引
    /// @param vote - 他们想投的票的类型
    function voteOnProposal(uint256 proposalIndex, Vote vote)
        external
        nftHolderOnly
        activeProposalOnly(proposalIndex)
    {
        Proposal storage proposal = proposals[proposalIndex];

        uint256 voterNFTBalance = zeroDot618NFT.balanceOf(msg.sender);
        uint256 numVotes = 0;

        // 计算投票者拥有多少个NFT
        // 还没有被用来对这个提案进行投票的
        for (uint256 i = 0; i < voterNFTBalance; i++) {
            uint256 tokenId = zeroDot618NFT.tokenOfOwnerByIndex(msg.sender, i);
            if (proposal.voters[tokenId] == false) {
                numVotes++;
                proposal.voters[tokenId] = true;
            }
        }
        require(numVotes > 0, "ALREADY_VOTED");

        if (vote == Vote.YAY) {
            proposal.yayVotes += numVotes;
        } else {
            proposal.nayVotes += numVotes;
        }
    }

    /// @dev executeProposal 允许任何 ZeroDot618NFT 持有人在超过截止日期后执行一项提案。
    /// @param proposalIndex - 提案数组中要执行的提案的索引
    function executeProposal(uint256 proposalIndex)
        external
        nftHolderOnly
        inactiveProposalOnly(proposalIndex)
    {
        Proposal storage proposal = proposals[proposalIndex];

        // 如果该提案的赞成票多于反对票
        // 从FakeNFTMarketplace 购买NFT
        if (proposal.yayVotes > proposal.nayVotes) {
            uint256 nftPrice = nftMarketplace.getPrice();
            require(address(this).balance >= nftPrice, "NOT_ENOUGH_FUNDS");
            nftMarketplace.purchase{value: nftPrice}(proposal.nftTokenId);
        }
        proposal.executed = true;
    }

    /// @dev withdrawEther 允许合约所有者（部署者）从合约中提取ETH
    function withdrawEther() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // 以下两个函数允许合约接受ETH存款
    // 直接从钱包中存入，而不需要调用函数
    receive() external payable {}

    fallback() external payable {}
}
