import assert from "node:assert/strict";

type CardSignal = {
  name: string;
  setCode: string;
  condition: "near_mint" | "excellent" | "played";
  marketPriceGbp: number;
  ownedQuantity: number;
};

type ListingDraft = {
  title: string;
  priceGbp: number;
  confidence: "low" | "medium" | "high";
  approvalRequired: true;
  evidence: string[];
};

function draftListing(card: CardSignal): ListingDraft {
  const conditionMultiplier = { near_mint: 1, excellent: 0.88, played: 0.65 }[card.condition];
  const priceGbp = Number((card.marketPriceGbp * conditionMultiplier).toFixed(2));
  const confidence = card.ownedQuantity > 0 && card.marketPriceGbp >= 1 ? "high" : "low";

  return {
    title: `${card.name} ${card.setCode} (${card.condition.replace("_", " ")})`,
    priceGbp,
    confidence,
    approvalRequired: true,
    evidence: [
      `market_price_gbp=${card.marketPriceGbp}`,
      `condition=${card.condition}`,
      `owned_quantity=${card.ownedQuantity}`,
    ],
  };
}

function demo(): void {
  const draft = draftListing({
    name: "Charizard ex",
    setCode: "sv3-125",
    condition: "excellent",
    marketPriceGbp: 42,
    ownedQuantity: 1,
  });

  assert.equal(draft.title, "Charizard ex sv3-125 (excellent)");
  assert.equal(draft.priceGbp, 36.96);
  assert.equal(draft.confidence, "high");
  assert.equal(draft.approvalRequired, true);
  assert.equal(draft.evidence.length, 3);

  console.log(JSON.stringify(draft, null, 2));
}

demo();
