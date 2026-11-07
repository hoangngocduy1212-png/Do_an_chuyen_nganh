"""Convert UCI Online Retail II workbook to implicit positive interactions."""
from __future__ import annotations
import argparse
from pathlib import Path
import pandas as pd


def prepare(source: Path, destination: Path, sheet_name: str | None = None) -> pd.DataFrame:
    """Prepare every year in the UCI workbook unless a sheet is selected."""
    required = {"Invoice", "StockCode", "Quantity", "InvoiceDate", "Customer ID"}
    prepared = []
    with pd.ExcelFile(source) as workbook:
        sheets = [sheet_name] if sheet_name else workbook.sheet_names
        for sheet in sheets:
            frame = pd.read_excel(workbook, sheet_name=sheet)
            frame.columns = [str(c).strip() for c in frame.columns]
            if not required.issubset(frame.columns):
                raise ValueError(f"Sheet {sheet!r} is missing columns: {sorted(required - set(frame.columns))}")
            frame = frame.dropna(subset=["Customer ID", "StockCode", "InvoiceDate"])
            frame["Invoice"] = frame["Invoice"].astype(str)
            frame["StockCode"] = frame["StockCode"].astype(str)
            # UCI marks returns with an invoice number beginning in C; they are not positive feedback.
            frame = frame[(~frame.Invoice.str.upper().str.startswith("C")) & (frame.Quantity > 0)]
            # Keep repeated purchases at different timestamps for chronological evaluation.
            interactions = (frame.groupby(["Customer ID", "StockCode", "InvoiceDate"], as_index=False)
                            .agg(strength=("Quantity", "sum"))
                            .rename(columns={"InvoiceDate": "timestamp"}))
            interactions = interactions.rename(columns={"Customer ID": "user_id", "StockCode": "item_id"})
            prepared.append(interactions)
    interactions = pd.concat(prepared, ignore_index=True)
    interactions = interactions.drop_duplicates(["user_id", "item_id", "timestamp"], keep="last")
    interactions["user_id"] = interactions.user_id.astype("int64").astype(str)
    interactions["timestamp"] = pd.to_datetime(interactions.timestamp, errors="coerce")
    interactions = interactions.dropna(subset=["timestamp"]).sort_values("timestamp")
    interactions.to_csv(destination, index=False)
    return interactions


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True, help="Path to UCI Online Retail II xlsx")
    parser.add_argument("--output", type=Path, default=Path("app/data/eval/online_retail_ii.csv"))
    parser.add_argument("--sheet", help="Optional workbook sheet; by default, process every year")
    args = parser.parse_args(); args.output.parent.mkdir(parents=True, exist_ok=True)
    result = prepare(args.source, args.output, args.sheet)
    print(f"Wrote {len(result):,} customer-item-time interactions from {args.source} to {args.output}")
