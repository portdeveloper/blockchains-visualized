import { ReactNode } from "react";

export type FocusId = "wallet" | "rpc" | "node" | "mempool" | "network" | "bob" | "block" | "chain" | "lifecycle";

export interface FocusInfo {
  id: FocusId;
  label: string;
  title: string;
  body: ReactNode;
  watch: string[];
  ethereum: string[];
}

export const FOCUS_ORDER: FocusId[] = ["wallet", "rpc", "node", "mempool", "network", "bob", "block", "chain", "lifecycle"];

export const FOCUS: Record<FocusId, FocusInfo> = {
  wallet: {
    id: "wallet", label: "browser & wallet", title: "A website and your wallet",
    body: (
      <>
        <p>Two separate programs live in this browser window. The <b>website</b> (a &quot;dapp&quot;) is an ordinary web page. It shows your balance and builds a transaction when you press Send, but it cannot sign anything.</p>
        <p>The <b>wallet extension</b> (the fox) is the only thing that holds your <b>private key</b>. When the site asks, it shows you exactly what you would be signing, and only signs if you confirm. Your money is not in either of them; it is a number in every node&apos;s state.</p>
      </>
    ),
    watch: ["Click the fox to see how your address was derived from a random private key, with real numbers.", "Press Send and read the popup. That is the last moment anyone can stop a transaction.", "The balance only changes after the site polls the RPC. Nothing is pushed to it.", "The private key never appears on any wire, and the website never sees it."],
    ethereum: ["MetaMask, Rabby and hardware wallets all work this way.", "The key is usually derived from a 12 or 24 word seed phrase.", "A dapp talks to the extension through a small API injected into the page (window.ethereum)."],
  },
  rpc: {
    id: "rpc", label: "RPC", title: "The RPC endpoint",
    body: (
      <>
        <p>An RPC is a plain web server that speaks a request and response language called <b>JSON-RPC</b>. It sits in front of one node and answers questions by reading that node&apos;s data: what is this balance, what is the latest block, did this transaction go through.</p>
        <p>It can also accept a signed transaction and pass it to the node. It cannot forge a signature or move funds, but it <em>can</em> lie about balances or quietly drop your transaction. That is why it matters who runs the RPC you trust.</p>
      </>
    ),
    watch: ["The last request and response are shown inside the box.", "Blue chips on the wire are requests, green chips are responses, grey chips are the app's routine polling.", "Every answer comes from one node's view, not from 'the network'."],
    ethereum: ["Infura, Alchemy and public endpoints are RPCs run by companies.", "Running your own node gives you your own RPC and removes that trust."],
  },
  node: {
    id: "node", label: "node", title: "A full node",
    body: (
      <>
        <p>A node is a computer running blockchain client software. It keeps a full copy of the chain, the current <b>state</b> (every account&apos;s balance and nonce), and a mempool of waiting transactions.</p>
        <p>When a new block arrives it does not take it on faith. It re-executes every transaction and checks that the resulting state root matches the one in the header. Only then does it add the block and forward it to its peers.</p>
      </>
    ),
    watch: ["The amber ring means this node proposes the next block.", "The state root is a fingerprint of all balances. It changes with every block.", "Head number should match the peers most of the time, but can lag by a moment."],
    ethereum: ["Thousands of nodes run software like Geth, Nethermind and Reth.", "A full node needs on the order of a terabyte of disk."],
  },
  mempool: {
    id: "mempool", label: "mempool", title: "The mempool",
    body: (
      <>
        <p>The mempool is the <b>waiting room</b>. A signed transaction that has been accepted by a node but not yet put in a block sits here. Every node has its own mempool, and they differ slightly because gossip takes time.</p>
        <p>The list is sorted by gas price. When it is this node&apos;s turn to propose, it takes the highest paying transactions first. A transaction can wait here for many blocks if it pays too little.</p>
      </>
    ),
    watch: ["Chips animate out of the mempool and into the new block on the right.", "A transaction whose nonce is out of order waits even if it pays well.", "Once a block from another node arrives, the included chips disappear from here too."],
    ethereum: ["Wallets call these 'pending' transactions.", "Bots watch the mempool to front-run trades. That is what MEV means."],
  },
  network: {
    id: "network", label: "network", title: "Peer-to-peer gossip",
    body: (
      <>
        <p>There is no central server. Each node connects to a handful of <b>peers</b> and forwards whatever it learns. A transaction submitted to one node reaches every node in a few hops. Blocks spread the same way.</p>
        <p>Because each hop takes real time, nodes are briefly out of sync. One node may already be at block 5 while another is still at 4. Consensus is the process by which they agree anyway.</p>
      </>
    ),
    watch: ["Blue dots are transactions in flight, amber squares are blocks.", "The followed transaction shows as a larger white dot.", "Right after a block is proposed, head numbers on the circles disagree for a moment."],
    ethereum: ["Nodes typically hold 25 to 50 peer connections.", "A block reaches most of the network in one to two seconds."],
  },
  bob: {
    id: "bob", label: "second user", title: "Bob, on a different node",
    body: (
      <>
        <p>Bob runs a shop. His website talks to a <b>different RPC</b> provider, which reads a <b>different node</b> (Frankfurt). Neither of you has ever connected to the same computer.</p>
        <p>Yet when you pay Bob, his balance rises, and when he pays you, yours does. Nobody reconciled anything. Both nodes replayed the same blocks and arrived at the same numbers. That is what &quot;one chain, many copies&quot; means in practice.</p>
      </>
    ),
    watch: ["Pay Bob and watch the green 'received' banner appear in his window a block later.", "Bob's block number can lag yours by a moment while a block is still gossiping to Frankfurt.", "Press Pay as Bob: his request travels to his own RPC, never to yours."],
    ethereum: ["Two people using MetaMask usually hit different RPC providers without knowing it.", "Wallets show the same balances because every node computes them the same way."],
  },
  block: {
    id: "block", label: "block", title: "A block",
    body: (
      <>
        <p>A block is a batch of transactions plus a <b>header</b>. The header records the block number, the hash of the previous block, who proposed it, a fingerprint of the transactions, and a fingerprint of the state after running them.</p>
        <p>The block&apos;s own hash is the hash of that header. Change anything inside the block and the hash changes, which is what makes tampering detectable.</p>
      </>
    ),
    watch: ["The prev field matches the hash of the block to its left.", "A green tick means the transaction succeeded, a red cross means it ran but failed and still paid its fee.", "Empty blocks are normal. The proposer simply had nothing to include."],
    ethereum: ["One block every 12 seconds.", "A block holds a few hundred transactions, bounded by a gas limit in the tens of millions.", "A simple transfer costs 21,000 gas. At 2 gwei per gas that is 0.000042 ETH."],
  },
  chain: {
    id: "chain", label: "chain", title: "The chain",
    body: (
      <>
        <p>The chain is an ordered list of blocks where each block points at the previous one by hash. Every node holds the same list. The state you see in your wallet is not stored separately; it is what you get by <b>replaying every block from the first one</b>.</p>
        <p>To alter an old block you would have to change its hash, which breaks the pointer in the next block, and the next, all the way to the tip. The deeper a block is, the more certain it is.</p>
      </>
    ),
    watch: ["New blocks spring in on the right, old ones slide left.", "Follow the prev hashes from right to left. They form an unbroken chain.", "Block 0 is the genesis block. It has no parent."],
    ethereum: ["Ethereum has produced over twenty million blocks since 2015.", "Blocks are considered final after about 13 minutes."],
  },
  lifecycle: {
    id: "lifecycle", label: "lifecycle", title: "Life of a transaction",
    body: (
      <>
        <p>This ribbon follows one transaction end to end. Built in the wallet, signed with a private key, handed to an RPC, checked and queued by a node, gossiped to peers, picked by a proposer, executed by every node, and finally buried under more blocks.</p>
        <p>Click any transaction chip anywhere on the canvas to follow it instead.</p>
      </>
    ),
    watch: ["Timestamps come from the simulated clock, so slow the speed down to see gaps between stages.", "Stage 5 lists when each node first heard of the transaction.", "Stage 8 counts confirmations. One is weak, many is strong."],
    ethereum: ["A typical transaction is included within one or two blocks.", "Wallets usually show 'confirmed' after one block and 'final' after about 13 minutes."],
  },
};
