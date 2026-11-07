export const recommenderBenchmark = {
  "dataset": {
    "name": "UCI Online Retail II",
    "period": "2009-12-01 – 2011-12-09"
  },
  "split": {
    "train": 521708,
    "validation": 72763,
    "test": 174359,
    "users": 5881,
    "items": 4631,
    "cold_users": 822,
    "cold_items": 394,
    "k": 10,
    "interactions": 768830,
    "train_ratio": 0.7,
    "validation_ratio": 0.1,
    "test_ratio": 0.2
  },
  "rows": [
    {
      "model": "Popularity",
      "scenario": "all_test",
      "recall": 0.015966525697775055,
      "ndcg": 0.051131792724163565,
      "hitRate": 0.3054812834224599,
      "coverage": 0.01865847897968824,
      "users": 2992
    },
    {
      "model": "Popularity",
      "scenario": "cold_user",
      "recall": 0.022267655091393817,
      "ndcg": 0.07838060319628859,
      "hitRate": 0.4257907542579075,
      "coverage": 0.0023618327822390174,
      "users": 822
    },
    {
      "model": "Popularity",
      "scenario": "cold_item_unseen_catalog",
      "recall": 0.0,
      "ndcg": 0.0,
      "hitRate": 0.0,
      "coverage": 0.01865847897968824,
      "users": 2613
    },
    {
      "model": "Popularity",
      "scenario": "warm_item",
      "recall": 0.020801159358824556,
      "ndcg": 0.052437445385119755,
      "hitRate": 0.30962059620596205,
      "coverage": 0.01865847897968824,
      "users": 2952
    },
    {
      "model": "ItemKNN",
      "scenario": "all_test",
      "recall": 0.022269999274806624,
      "ndcg": 0.06325628474292677,
      "hitRate": 0.3649732620320856,
      "coverage": 0.2017005196032121,
      "users": 2992
    },
    {
      "model": "ItemKNN",
      "scenario": "cold_user",
      "recall": 0.022267655091393817,
      "ndcg": 0.07838060319628859,
      "hitRate": 0.4257907542579075,
      "coverage": 0.0023618327822390174,
      "users": 822
    },
    {
      "model": "ItemKNN",
      "scenario": "cold_item_unseen_catalog",
      "recall": 0.0,
      "ndcg": 0.0,
      "hitRate": 0.0,
      "coverage": 0.18209730751062825,
      "users": 2613
    },
    {
      "model": "ItemKNN",
      "scenario": "warm_item",
      "recall": 0.030377831818274584,
      "ndcg": 0.06577885641908054,
      "hitRate": 0.3699186991869919,
      "coverage": 0.19768540387340577,
      "users": 2952
    },
    {
      "model": "BPR",
      "scenario": "all_test",
      "recall": 0.02218336565817248,
      "ndcg": 0.06224154008060437,
      "hitRate": 0.35628342245989303,
      "coverage": 0.5441662730278696,
      "users": 2992
    },
    {
      "model": "BPR",
      "scenario": "cold_user",
      "recall": 0.022267655091393817,
      "ndcg": 0.07838060319628859,
      "hitRate": 0.4257907542579075,
      "coverage": 0.0023618327822390174,
      "users": 822
    },
    {
      "model": "BPR",
      "scenario": "cold_item_unseen_catalog",
      "recall": 0.0,
      "ndcg": 0.0,
      "hitRate": 0.0,
      "coverage": 0.5205479452054794,
      "users": 2613
    },
    {
      "model": "BPR",
      "scenario": "warm_item",
      "recall": 0.03065142307686486,
      "ndcg": 0.06464674226012003,
      "hitRate": 0.3611111111111111,
      "coverage": 0.5422768068020785,
      "users": 2952
    },
    {
      "model": "LightGCN",
      "scenario": "all_test",
      "recall": 0.02690836961038433,
      "ndcg": 0.07380557742658019,
      "hitRate": 0.40106951871657753,
      "coverage": 0.32120925838450637,
      "users": 2992
    },
    {
      "model": "LightGCN",
      "scenario": "cold_user",
      "recall": 0.022267655091393817,
      "ndcg": 0.07838060319628859,
      "hitRate": 0.4257907542579075,
      "coverage": 0.0023618327822390174,
      "users": 822
    },
    {
      "model": "LightGCN",
      "scenario": "cold_item_unseen_catalog",
      "recall": 0.0,
      "ndcg": 0.0,
      "hitRate": 0.0,
      "coverage": 0.30420406235238545,
      "users": 2613
    },
    {
      "model": "LightGCN",
      "scenario": "warm_item",
      "recall": 0.037453195408139225,
      "ndcg": 0.0770006264591897,
      "hitRate": 0.4065040650406504,
      "coverage": 0.31931979215871514,
      "users": 2952
    }
  ]
} as const;
