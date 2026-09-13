"use client";
import { useState } from "react";
import { SimpleBlock, mine } from "@/lib/blockhash";
import { Chain, makeChain, relink } from "./Chain";

function minedChain(datas: string[]): SimpleBlock[] {
  let chain = makeChain(datas);
  for (let i = 0; i < chain.length; i++) {
    chain[i] = { ...chain[i], nonce: mine(chain[i]).nonce };
    chain = relink(chain);
  }
  return chain;
}

export function Step3Chain() {
  const [chain, setChain] = useState<SimpleBlock[]>(() => minedChain(["Alice pays Bob 5", "Bob pays Carol 2", "Carol pays Dave 1", "Dave pays Alice 3"]));
  return <Chain chain={chain} onChange={setChain} compact />;
}
