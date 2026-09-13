import { ReactNode } from "react";
import { Step1Hash } from "./Step1Hash";
import { Step2Block } from "./Step2Block";
import { Step3Chain } from "./Step3Chain";
import { Step4Peers } from "./Step4Peers";

export interface Step {
  slug: string;
  title: string;
  adds: string;
  body: ReactNode;
  tryThis: string[];
  widget: ReactNode;
}

export const STEPS: Step[] = [
  {
    slug: "hash",
    title: "A hash is a fingerprint",
    adds: "hash function",
    body: (
      <>
        <p>Before we can build anything, we need one tool: a <b>hash function</b>. Feed it any data and it spits out a fixed-size fingerprint.</p>
        <p>Three things make it useful. The same input always gives the same fingerprint. A tiny change to the input gives a totally different fingerprint. And you can never work backwards from the fingerprint to the data.</p>
        <p>Every hash you see in this course is a real keccak256, the one Ethereum uses.</p>
      </>
    ),
    tryThis: ["Type your name. Note the hash.", "Change one letter. Almost every character of the hash changes.", "Delete everything and paste a whole paragraph. Still 64 characters."],
    widget: <Step1Hash />,
  },
  {
    slug: "block",
    title: "A block is data with a puzzle attached",
    adds: "block",
    body: (
      <>
        <p>Now we hash something more structured. A <b>block</b> holds some data, and a number called a <b>nonce</b> that means nothing by itself.</p>
        <p>We add a rule: a block only counts as valid if its hash starts with <code>0000</code>. The only way to get there is to keep changing the nonce and re-hashing until you get lucky. That guessing is called <b>mining</b>.</p>
        <p>The point is not the zeros. The point is that making a valid block <em>costs work</em>, and anyone can check it instantly.</p>
      </>
    ),
    tryThis: ["Press +1 a few times. Watch the hash change and stay red.", "Press mine. See how many tries it took.", "Now change the data. The block goes red again. Someone would have to redo the work."],
    widget: <Step2Block />,
  },
  {
    slug: "chain",
    title: "A chain is blocks that point backwards",
    adds: "prev pointer",
    body: (
      <>
        <p>Here is the trick that gives the blockchain its name. Every block includes the <b>hash of the block before it</b> as part of its own data.</p>
        <p>So if you change anything in block 2, its hash changes. Block 3 was built on the old hash, so block 3 is now wrong too. And block 4. All the way to the end.</p>
        <p>To cover up a change, you would have to re-mine every block after it. The longer the chain gets, the more work that is.</p>
      </>
    ),
    tryThis: ["Change the data in block 2. Blocks 2, 3 and 4 all turn red.", "Mine block 2. Block 3 is still red, because block 2's hash changed again.", "Mine 3, then 4. Feel how much work fixing one old block costs."],
    widget: <Step3Chain />,
  },
  {
    slug: "peers",
    title: "Many copies, and the majority wins",
    adds: "peers",
    body: (
      <>
        <p>One chain on one computer proves nothing. Whoever owns the computer can re-mine everything. So instead, <b>everyone keeps a copy</b>.</p>
        <p>Alice, Bob and Carol each hold the same chain. To check whether they agree, they don&apos;t need to compare every block. They just compare the <b>hash of the latest block</b>. If those match, the whole history matches.</p>
        <p>If one copy differs, it&apos;s the odd one out. This is the simplest form of <b>consensus</b>: the version most peers hold is the truth.</p>
      </>
    ),
    tryThis: ["Change block 1 in Bob's copy and re-mine all three blocks so they are green again.", "Bob's chain is fully valid, yet it still disagrees with Alice and Carol.", "Valid is not enough. You have to match everyone else."],
    widget: <Step4Peers />,
  },
];
