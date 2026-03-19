import pandas as pd
import numpy as np
from sdv.single_table import CTGANSynthesizer
from sdv.metadata import SingleTableMetadata
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import warnings
import datetime

warnings.filterwarnings("ignore")

DEMAND_GROWTH_RATE = 1.15

def _build_seed_data(current_month_sales_df):
    np.random.seed(42)
    rows = []
    sales_this_month = (
        current_month_sales_df
        .groupby("item_name", as_index=False)["qty"]
        .sum()
    )

    for _, row in sales_this_month.iterrows():
        item_name    = row["item_name"]
        sold_qty     = max(int(row["qty"]), 1)
        next_month_qty = int(round(sold_qty * DEMAND_GROWTH_RATE))

        for _ in range(2):
            for month in range(1, 13):
                noise = np.random.uniform(0.90, 1.10)
                qty   = max(int(round(next_month_qty * noise)), 0)
                rows.append({
                    "month":     month,
                    "item_name": item_name,
                    "qty":       qty,
                })

    return pd.DataFrame(rows)


def predict_demand(sales_data_list):
    print("\n📊 ML Pipeline: Starting demand prediction...")
    if not sales_data_list:
        print("   ℹ️  No sales data provided. Cannot predict.")
        return []

    all_sales_df = pd.DataFrame(sales_data_list)
    all_sales_df["month"]     = all_sales_df["month"].astype(int)
    all_sales_df["qty"]       = all_sales_df["qty"].astype(int)
    all_sales_df["item_name"] = all_sales_df["item_name"].astype(str)

    current_month    = datetime.datetime.now().month
    current_month_df = all_sales_df[all_sales_df["month"] == current_month].copy()

    if current_month_df.empty:
        print(f"   ⚠️  No sales recorded for current month ({current_month}). Generating fallback pseudo-data from history.")
        # Create fake current month by averaging all past sales per product
        fallback_df = all_sales_df.groupby("item_name", as_index=False)["qty"].mean()
        fallback_df["month"] = current_month
        fallback_df["qty"] = fallback_df["qty"].round().astype(int)
        
        # Filter out any products where averge rounds down to 0
        current_month_df = fallback_df[fallback_df["qty"] > 0]
        
    if current_month_df.empty:
        print(f"   ℹ️  No historical sales available to generate fake data. Cannot predict.")
        return []

    products_this_month = current_month_df["item_name"].unique().tolist()
    print(f"   ✅ Current month ({current_month}) — {len(current_month_df)} records, {len(products_this_month)} products")

    seed_df = _build_seed_data(current_month_df)

    if len(all_sales_df) > len(current_month_df):
        history_df = all_sales_df[all_sales_df["item_name"].isin(products_this_month)].copy()
        boosted    = pd.concat([history_df] * 3, ignore_index=True)
        seed_df    = pd.concat([seed_df, boosted], ignore_index=True)

    try:
        print("   🔄 Training CTGAN (~30–60 seconds)...")
        metadata = SingleTableMetadata()
        metadata.detect_from_dataframe(seed_df)
        metadata.update_column("month",     sdtype="numerical")
        metadata.update_column("item_name", sdtype="categorical")
        metadata.update_column("qty",       sdtype="numerical")

        synthesizer = CTGANSynthesizer(
            metadata,
            epochs=150,
            batch_size=500,
            verbose=False,
        )
        synthesizer.fit(seed_df)

        synthetic_df = synthesizer.sample(num_rows=10_000)
        synthetic_df["qty"]   = synthetic_df["qty"].clip(lower=0).round().astype(int)
        synthetic_df["month"] = synthetic_df["month"].clip(1, 12).round().astype(int)
        print(f"   ✅ CTGAN generated: {len(synthetic_df)} synthetic rows")

    except Exception as e:
        print(f"   ⚠️  CTGAN failed ({e}). Using statistical fallback.")
        repeats      = (10_000 // len(seed_df)) + 1
        synthetic_df = pd.concat([seed_df] * repeats, ignore_index=True).head(10_000).copy()
        noise        = np.random.uniform(0.90, 1.10, size=len(synthetic_df))
        synthetic_df["qty"] = (synthetic_df["qty"] * noise).clip(lower=0).round().astype(int)

    training_df = pd.concat([seed_df, synthetic_df], ignore_index=True)

    try:
        le = LabelEncoder()
        le.fit(products_this_month)

        training_df = training_df[training_df["item_name"].isin(products_this_month)].copy()
        training_df["item_code"] = le.transform(training_df["item_name"])

        X = training_df[["month", "item_code"]]
        y = training_df["qty"]

        regressor = RandomForestRegressor(
            n_estimators=200,
            max_depth=12,
            min_samples_leaf=5,
            n_jobs=-1,
            random_state=42,
        )
        regressor.fit(X, y)

    except Exception as e:
        print(f"   ❌ Model training failed: {e}")
        return []

    next_month = (current_month % 12) + 1
    predictions = []
    for product in products_this_month:
        item_code     = le.transform([product])[0]
        X_pred        = pd.DataFrame([{"month": next_month, "item_code": item_code}])
        predicted_qty = max(int(round(regressor.predict(X_pred)[0])), 0)
        predictions.append({
            "item_name":     product,
            "predicted_qty": predicted_qty,
            "month":         next_month,
        })

    predictions.sort(key=lambda x: x["predicted_qty"], reverse=True)
    return predictions
