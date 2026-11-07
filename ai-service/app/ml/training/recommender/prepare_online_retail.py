"""Convert UCI Online Retail II workbook to implicit positive interactions."""
from __future__ import annotations
import argparse
from pathlib import Path
import pandas as pd


def prepare(source: Path, destination: Path) -> pd.DataFrame:
    frame = pd.read_excel(source)
    frame.columns = [str(c).strip() for c in frame.columns]
    required = {"Invoice", "StockCode", "Quantity", "InvoiceDate", "Customer ID"}
    if not required.issubset(frame.columns):
        raise ValueError(f"Missing columns: {sorted(required - set(frame.columns))}")
    frame = frame.dropna(subset=["Customer ID", "StockCode", "InvoiceDate"])
    frame["Invoice"] = frame["Invoice"].astype(str)
    frame["StockCode"] = frame["StockCode"].astype(str)
    # UCI marks returns with an invoice number beginning in C; they are not positive feedback.
    frame = frame[(~frame.Invoice.str.upper().str.startswith("C")) & (frame.Quantity > 0)]
    # Preserve repeat purchases across time. Only combine duplicate SKU lines
    # within the same instant so earlier purchases remain visible to the split.
    interactions = (frame.groupby(["Customer ID", "StockCode", "InvoiceDate"], as_index=False)
                    .agg(strength=("Quantity", "sum"))
                    .rename(columns={"InvoiceDate": "timestamp"}))
    interactions = interactions.rename(columns={"Customer ID": "user_id", "StockCode": "item_id"})
    interactions["user_id"] = interactions.user_id.astype("int64").astype(str)
    interactions.to_csv(destination, index=False)
    return interactions


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True, help="Path to UCI Online Retail II xlsx")
    parser.add_argument("--output", type=Path, default=Path("app/data/eval/online_retail_ii.csv"))
    args = parser.parse_args(); args.output.parent.mkdir(parents=True, exist_ok=True)
    result = prepare(args.source, args.output)
    print(f"Wrote {len(result):,} customer-item interactions to {args.output}")
