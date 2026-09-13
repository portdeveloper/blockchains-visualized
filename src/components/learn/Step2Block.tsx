"use client";
import { useState } from "react";
import { SimpleBlock, ZERO } from "@/lib/blockhash";
import { BlockBox } from "./BlockBox";

export function Step2Block() {
  const [block, setBlock] = useState<SimpleBlock>({ number: 1, nonce: 0, data: "Alice pays Bob 5", prev: ZERO });
  return <BlockBox block={block} onChange={setBlock} showPrev={false} ports={{ out: true }} />;
}
