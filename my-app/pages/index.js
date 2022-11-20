import { Contract, providers } from "ethers";
import { formatEther } from "ethers/lib/utils";
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import Web3Modal from "web3modal";
import {
  ZERODOT618_DAO_ABI,
  ZERODOT618_DAO_CONTRACT_ADDRESS,
  ZERODOT618_NFT_ABI,
  ZERODOT618_NFT_CONTRACT_ADDRESS,
} from "../constants";
import styles from "../styles/Home.module.css";

export default function Home() {
  // DAO合约的ETH余额
  const [treasuryBalance, setTreasuryBalance] = useState("0");
  // 在DAO中创建的提案数量
  const [numProposals, setNumProposals] = useState("0");
  // 在DAO中创建的所有提案的数组
  const [proposals, setProposals] = useState([]);
  // ZeroDot618 NFTs的用户余额
  const [nftBalance, setNftBalance] = useState(0);
  // 购买假的NFT代币ID，在创建一个提案时使用
  const [fakeNftTokenId, setFakeNftTokenId] = useState("");
  // "创建提案 "或 "查看提案 "中的一个
  const [selectedTab, setSelectedTab] = useState("");
  // 如果等待交易被开采，则为真，否则为假。
  const [loading, setLoading] = useState(false);
  // 如果用户已经连接了他们的钱包，则为真，否则为假
  const [walletConnected, setWalletConnected] = useState(false);
  const web3ModalRef = useRef();

  /**
   * 返回一个代表Ethereum RPC的提供者或签署者对象，无论是否有签署能力的metamask附件
   *
   * provider 用于与区块链互动--读取交易、读取余额、读取状态等。
   * signer 是一种特殊类型的 provider，用于需要向区块链进行 "写 "交易的情况，这涉及到连接的账户
   * 需要进行数字签名以授权正在发送的交易
   * Metamask暴露了一个签名者API，允许你的网站使用 Signer 函数向用户请求签名。
   * 
   * @param {*} needSigner - 如果你需要 signer，则为真，否则默认为假。
   */
  const getProviderOrSigner = async (needSigner = false) => {
    // 连接 Metemask
    // 由于我们将 web3Modal 存储为一个引用，我们需要访问 current 值，以获得对底层对象的访问。
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    // 如果用户连接的不是 Goerli 网络，则要抛出错误告知用户
    const { chainId } = await web3Provider.getNetwork();
    if (chainId !== 5) {
      window.alert("change the network to Goerli");
      throw new Error("Change network to Goerli");
    }

    if (needSigner) {
      const signer = web3Provider.getSigner();
      return signer
    }
    return web3Provider;
  }

  // 连接钱包
  const connectWallet = async () => {
    try {
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch (error) {
      console.error(error);
    }
  };

  // 读取DAO合约的ETH余额并设置 treasuryBalance 状态变量
  const getDAOTreasuryBalance = async () => {
    try {
      const provider = await getProviderOrSigner()
      const balance = await provider.getBalance(
        ZERODOT618_DAO_CONTRACT_ADDRESS
      );
      setTreasuryBalance(balance.toString());
    } catch (error) {
      console.error(error)
    }
  }

  // 读取DAO合同中的提案数量并设置 numProposals 状态变量
  const getNumProposalsInDAO = async () => {
    try {
      const provider = await getProviderOrSigner()
      const contract = getDaoContractInstance(provider);
      const daoNumProposals = await contract.numProposals();
      setNumProposals(daoNumProposals.toString());
    } catch (error) {
      console.error(error)
    }
  }

  // 读取用户的ZeroDot618 NFTs的余额并设置 nftBalance 状态变量
  const getUserNFTBalance = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const nftContract = getZERODOT618NFTContractInstance(signer);
      const balance = await nftContract.balanceOf(signer.getAddress());
      setNftBalance(parseInt(balance.toString()));
    } catch (error) {
      console.error(error);
    }
  };

  // 使用来自 fakeNftTokenId 的tokenId调用合约中的`createProposal`函数
  const createProposal = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      const txn = await daoContract.createProposal(fakeNftTokenId);
      setLoading(true);
      await txn.wait();
      await getNumProposalsInDAO();
      setLoading(false);
    } catch (error) {
      console.error(error);
      window.alert(error.data.message);
    }
  };

  // 帮助函数，从DAO合同中获取并解析一个提案
  // id - 提案的ID
  // 将返回的数据转换为一个Javascript对象，其值我们可以使用
  const fetchProposalById = async (id) => {
    try {
      const provider = await getProviderOrSigner();
      const daoContract = getDaoContractInstance(provider);
      const proposal = await daoContract.proposals(id);
      const parsedProposal = {
        proposalId: id,
        nftTokenId: proposal.nftTokenId.toString(),
        deadline: new Date(parseInt(proposal.deadline.toString()) * 1000),
        yayVotes: proposal.yayVotes.toString(),
        nayVotes: proposal.nayVotes.toString(),
        executed: proposal.executed,
      };
      return parsedProposal;
    } catch (error) {
      console.error(error);
    }
  };

  // 循环运行 numProposals 次，获取DAO中的所有提案
  // 并设置 "proposals 状态变量
  const fetchAllProposals = async () => {
    try {
      const proposals = [];
      for (let i = 0; i < numProposals; i++) {
        const proposal = await fetchProposalById(i);
        proposals.push(proposal);
      }
      setProposals(proposals);
      return proposals;
    } catch (error) {
      console.error(error);
    }
  };

  // 调用合约中的 voteOnProposal 函数，使用传递的 proposalId和_vote
  const voteOnProposal = async (proposalId, _vote) => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);

      let vote = _vote === "YAY" ? 0 : 1;
      const txn = await daoContract.voteOnProposal(proposalId, vote);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
    } catch (error) {
      console.error(error);
      window.alert(error.data.message);
    }
  };

  // 调用合约中的 executeProposal 函数，使用传递的 proposalId
  const executeProposal = async (proposalId) => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      const txn = await daoContract.executeProposal(proposalId);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
    } catch (error) {
      console.error(error);
      window.alert(error.data.message);
    }
  };

  // 返回DAO合约实例的辅助函数
  // 给定一个提供者/签署者
  const getDaoContractInstance = (providerOrSigner) => {
    return new Contract(
      ZERODOT618_DAO_CONTRACT_ADDRESS,
      ZERODOT618_DAO_ABI,
      providerOrSigner
    );
  };

  // 返回 ZeroDot618 NFT 合约实例的辅助函数
  // 给定一个提供者/签署者
  const getZERODOT618NFTContractInstance = (providerOrSigner) => {
    return new Contract(
      ZERODOT618_NFT_CONTRACT_ADDRESS,
      ZERODOT618_NFT_ABI,
      providerOrSigner
    );
  };

  // 每当 walletConnected 的值发生变化时，运行一段代码
  // 所以当一个钱包连接或断开连接时
  // 如果没有连接，则提示用户连接钱包
  // 然后调用辅助函数来获取DAO余额，用户NFT余额，以及DAO中的提案数量
  useEffect(() => {
    if (!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: "goerli",
        providerOptions: {},
        disableInjectedProvider: false,
      });

      connectWallet().then(() => {
        getDAOTreasuryBalance();
        getUserNFTBalance();
        getNumProposalsInDAO();
      });
    }
  }, [walletConnected]);

  // 每当 selectedTab 的值发生变化时，运行一段代码
  // 当用户切换到 "查看提案 "标签时，用于重新获取DAO中的所有提案。
  // 到 "查看提案 "标签时，重新获取DAO中的所有提案
  useEffect(() => {
    if (selectedTab === "提案列表") {
      fetchAllProposals();
    }
  }, [selectedTab]);

  // 根据 electedTab 渲染相应标签的内容
  function renderTabs() {
    if (selectedTab === "创建提案") {
      return renderCreateProposalTab();
    } else if (selectedTab === "提案列表") {
      return renderViewProposalsTab();
    }
    return null;
  }

  // 呈现 "创建提案 "标签内容
  function renderCreateProposalTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... 等待交易...
        </div>
      );
    } else if (nftBalance === 0) {
      return (
        <div className={styles.description}>
          你还没有 ZeroDot618 NFTs. <br />
          <b>你不能创建或投票提案</b>
        </div>
      );
    } else {
      return (
        <div className={styles.container}>
          <label>购买 Fake NFT: </label>
          <input
            placeholder="0"
            type="number"
            onChange={(e) => setFakeNftTokenId(e.target.value)}
          />
          <button className={styles.button2} onClick={createProposal}>
            创建
          </button>
        </div>
      );
    }
  }

  // 呈现 "提案列表 "标签的内容
  function renderViewProposalsTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... 等待交易...
        </div>
      );
    } else if (proposals.length === 0) {
      return (
        <div className={styles.description}>还没创建任何提案</div>
      );
    } else {
      return (
        <div>
          {proposals.map((p, index) => (
            <div key={index} className={styles.proposalCard}>
              <p>提案 ID: {p.proposalId}</p>
              <p>购买的 Fake NFT ID: {p.nftTokenId}</p>
              <p>截止时间: {p.deadline.toLocaleString()}</p>
              <p>赞成票: {p.yayVotes}</p>
              <p>反对票: {p.nayVotes}</p>
              <p>是否执行?: {p.executed.toString()}</p>
              {p.deadline.getTime() > Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "YAY")}
                  >
                    投赞成票
                  </button>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "NAY")}
                  >
                    投反对票
                  </button>
                </div>
              ) : p.deadline.getTime() < Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => executeProposal(p.proposalId)}
                  >
                    Execute Proposal{" "}
                    {p.yayVotes > p.nayVotes ? "(YAY)" : "(NAY)"}
                  </button>
                </div>
              ) : (
                <div className={styles.description}>提案执行</div>
              )}
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>ZeroDot618 DAO</title>
        <meta name="description" content="ZeroDot618 DAO" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to ZeroDot618 Devs!</h1>
          <div className={styles.description}>Welcome to the DAO!</div>
          <div className={styles.description}>
            Your ZeroDot618 NFT Balance: {nftBalance}
            <br />
            Treasury Balance: {formatEther(treasuryBalance)} ETH
            <br />
            Total Number of Proposals: {numProposals}
          </div>
          <div className={styles.flex}>
            <button
              className={styles.button}
              onClick={() => setSelectedTab("创建提案")}
            >
              创建提案
            </button>
            <button
              className={styles.button}
              onClick={() => setSelectedTab("提案列表")}
            >
              提案列表
            </button>
          </div>
          {renderTabs()}
        </div>
        <div>
          <img className={styles.image} src="/zeroDot618/0.svg" />
        </div>
      </div>

      <footer className={styles.footer}>
        Made with &#10084; by ZeroDot618 Devs
      </footer>
    </div>
  )
}
