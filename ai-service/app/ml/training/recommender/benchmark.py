"""Temporal implicit-feedback benchmark for the recommender thesis task.

Input CSV is the cleaned interaction table produced by prepare_online_retail.py.
The benchmark is intentionally offline and does not alter application serving.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity


@dataclass
class Split:
    train: pd.DataFrame
    valid: pd.DataFrame
    test: pd.DataFrame


def temporal_split(events: pd.DataFrame, train_ratio: float = .7, valid_ratio: float = .1) -> Split:
    """Global chronological split; equal timestamps never cross partitions."""
    times = np.sort(events.timestamp.dropna().unique())
    if len(times) < 3:
        raise ValueError("At least three distinct timestamps are required")
    train_end = times[max(0, int(len(times) * train_ratio) - 1)]
    valid_end = times[max(int(len(times) * train_ratio), int(len(times) * (train_ratio + valid_ratio)) - 1)]
    train = events[events.timestamp <= train_end].copy()
    valid = events[(events.timestamp > train_end) & (events.timestamp <= valid_end)].copy()
    test = events[events.timestamp > valid_end].copy()
    if min(len(train), len(valid), len(test)) == 0:
        raise ValueError("Temporal split produced an empty partition; adjust ratios or use more data")
    return Split(train, valid, test)


def _matrix(train: pd.DataFrame, users: pd.Index, items: pd.Index) -> csr_matrix:
    ui = pd.MultiIndex.from_frame(train[["user_id", "item_id"]])
    rows = users.get_indexer(ui.get_level_values(0)); cols = items.get_indexer(ui.get_level_values(1))
    keep = (rows >= 0) & (cols >= 0)
    return csr_matrix((np.ones(keep.sum(), dtype=np.float32), (rows[keep], cols[keep])), shape=(len(users), len(items)))


class Recommender:
    def fit(self, train: pd.DataFrame): raise NotImplementedError
    def score(self, user: str, candidates: np.ndarray) -> np.ndarray: raise NotImplementedError


class Popularity(Recommender):
    def fit(self, train):
        self.pop = train.item_id.value_counts().to_dict(); self.seen = defaultdict(set)
        for u, i in train[["user_id", "item_id"]].itertuples(index=False, name=None): self.seen[u].add(i)
        return self
    def score(self, user, candidates): return np.array([self.pop.get(i, 0) for i in candidates], dtype=float)


class ItemKNN(Popularity):
    def __init__(self, neighbors=50): self.neighbors = neighbors
    def fit(self, train):
        super().fit(train); self.users = pd.Index(train.user_id.unique()); self.items = pd.Index(train.item_id.unique())
        x = _matrix(train, self.users, self.items)
        sim = cosine_similarity(x.T, dense_output=True); np.fill_diagonal(sim, 0)
        self.sim = sim; self.item_index = {v: i for i, v in enumerate(self.items)}
        neighbor_ids=np.argpartition(sim,-min(self.neighbors, max(1,sim.shape[0]-1)),axis=1)[:,-min(self.neighbors, max(1,sim.shape[0]-1)):]
        self.neighbor_ids=neighbor_ids; self.neighbor_scores=np.take_along_axis(sim,neighbor_ids,axis=1)
        self.user_items = {u: [self.item_index[i] for i in self.seen[u] if i in self.item_index] for u in self.users}
        return self
    def score(self, user, candidates):
        hist = self.user_items.get(user, [])
        if not hist: return super().score(user,candidates)
        scores=np.zeros(len(self.items),dtype=float)
        np.add.at(scores,self.neighbor_ids[hist].ravel(),self.neighbor_scores[hist].ravel())
        return np.asarray([scores[self.item_index[item]] if item in self.item_index else 0.0 for item in candidates])


class TorchGraphModel(Recommender):
    """BPR matrix factorization or LightGCN; requires PyTorch (CPU is supported)."""
    def __init__(self, graph=False, dim=32, epochs=15, lr=.01, layers=2, seed=42):
        self.graph, self.dim, self.epochs, self.lr, self.layers, self.seed = graph, dim, epochs, lr, layers, seed
    def fit(self, train):
        import torch
        from torch import nn
        torch.manual_seed(self.seed); np.random.seed(self.seed); torch.set_num_threads(min(4, torch.get_num_threads()))
        self.users = pd.Index(train.user_id.unique()); self.items = pd.Index(train.item_id.unique())
        self.u2i = {v:i for i,v in enumerate(self.users)}; self.i2i = {v:i for i,v in enumerate(self.items)}
        pairs = [(self.u2i[u], self.i2i[i]) for u,i in train[["user_id","item_id"]].itertuples(index=False,name=None)]
        self.positive = defaultdict(set)
        for u,i in pairs: self.positive[u].add(i)
        n_users,n_items=len(self.users),len(self.items)
        class Model(nn.Module):
            def __init__(m):
                super().__init__(); m.u=nn.Embedding(n_users,self.dim); m.i=nn.Embedding(n_items,self.dim)
                nn.init.normal_(m.u.weight,std=.1); nn.init.normal_(m.i.weight,std=.1)
                if self.graph:
                    edges=np.asarray(pairs,dtype=np.int64)
                    r=np.r_[edges[:,0], edges[:,1]+n_users]; c=np.r_[edges[:,1]+n_users, edges[:,0]]
                    deg=np.bincount(r,minlength=n_users+n_items).clip(1); vals=(deg[r]*deg[c])**-.5
                    adj=torch.sparse_coo_tensor(torch.tensor(np.array([r,c])),torch.tensor(vals,dtype=torch.float32),(n_users+n_items,n_users+n_items)).coalesce()
                    m.register_buffer("adj",adj)
            def forward(m):
                if not self.graph: return m.u.weight,m.i.weight
                z=torch.cat([m.u.weight,m.i.weight]); layers=[z]
                for _ in range(self.layers): z=torch.sparse.mm(m.adj,z); layers.append(z)
                z=torch.stack(layers).mean(0); return z[:n_users],z[n_users:]
        self.model=Model(); opt=torch.optim.Adam(self.model.parameters(),lr=self.lr); rng=np.random.default_rng(self.seed)
        batch_size=4096 if self.graph else 1024
        for _ in range(self.epochs):
            rng.shuffle(pairs)
            for start in range(0,len(pairs),batch_size):
                batch=pairs[start:start+batch_size]
                if not batch: continue
                us=np.array([p[0] for p in batch]); pos=np.array([p[1] for p in batch]); neg=[]
                for u in us:
                    j=rng.integers(n_items)
                    while j in self.positive[u] and len(self.positive[u]) < n_items: j=rng.integers(n_items)
                    neg.append(j)
                ut=torch.tensor(us); pt=torch.tensor(pos); nt=torch.tensor(neg)
                if self.graph:
                    all_u,all_i=self.model(); uemb,pemb,nemb=all_u[ut],all_i[pt],all_i[nt]
                else:
                    uemb=self.model.u(ut); pemb=self.model.i(pt); nemb=self.model.i(nt)
                delta=(uemb*pemb).sum(1)-(uemb*nemb).sum(1)
                loss=-torch.nn.functional.logsigmoid(delta).mean()+1e-4*(uemb.square().sum()+pemb.square().sum()+nemb.square().sum())/len(us)
                opt.zero_grad(); loss.backward(); opt.step()
        with torch.no_grad(): self.u,self.i=[x.detach().cpu().numpy() for x in self.model()]
        self.pop=Counter(i for _,i in train[["user_id","item_id"]].itertuples(index=False,name=None)); self.seen=defaultdict(set)
        for u,i in train[["user_id","item_id"]].itertuples(index=False,name=None): self.seen[u].add(i)
        return self
    def score(self,user,candidates):
        u=self.u2i.get(user)
        if u is None:
            return np.array([self.pop.get(i, 0) for i in candidates], dtype=float)
        out=[]
        for item in candidates:
            i=self.i2i.get(item); out.append(float(self.u[u]@self.i[i]) if u is not None and i is not None else 0.0)
        return np.asarray(out)


def evaluate(model, train, test, k=10):
    relevant=defaultdict(set); known=defaultdict(set)
    for u,i in train[["user_id","item_id"]].itertuples(index=False,name=None): known[u].add(i)
    for u,i in test[["user_id","item_id"]].itertuples(index=False,name=None):
        if i not in known[u]: relevant[u].add(i)
    catalog=set(train.item_id); recalls=[]; ndcgs=[]; hits=[]; recommended=set()
    for user,truth in relevant.items():
        candidates=np.array(sorted(catalog - model.seen.get(user,set())),dtype=object)
        if not len(candidates): continue
        ranked=candidates[np.argsort(-model.score(user,candidates))[:k]]
        gains=np.array([1.0 if i in truth else 0.0 for i in ranked]); denom=sum(1/np.log2(j+2) for j in range(min(len(truth),k)))
        recalls.append(gains.sum()/len(truth)); ndcgs.append(float(sum(g/np.log2(j+2) for j,g in enumerate(gains))/denom) if denom else 0); hits.append(float(gains.sum()>0)); recommended.update(ranked)
    return {f"Recall@{k}":float(np.mean(recalls)) if recalls else 0, f"NDCG@{k}":float(np.mean(ndcgs)) if ndcgs else 0, f"HitRate@{k}":float(np.mean(hits)) if hits else 0, "Coverage":len(recommended)/max(1,len(catalog)), "users":len(recalls)}


def run(data: Path, output: Path, k=10, epochs=15, seed=42):
    events=pd.read_csv(data); events["timestamp"]=pd.to_datetime(events.timestamp,utc=True)
    events=events[["user_id","item_id","timestamp"]].dropna().drop_duplicates(["user_id","item_id","timestamp"])
    events.user_id=events.user_id.astype(str); events.item_id=events.item_id.astype(str)
    split=temporal_split(events); output.mkdir(parents=True,exist_ok=True); rows=[]
    cold_users=set(split.test.user_id)-set(split.train.user_id); cold_items=set(split.test.item_id)-set(split.train.item_id)
    models=[("Popularity",Popularity()),("ItemKNN",ItemKNN()),("BPR",TorchGraphModel(epochs=epochs,seed=seed)),("LightGCN",TorchGraphModel(graph=True,epochs=epochs,seed=seed))]
    for name,model in models:
        print(f"Fitting {name} on {len(split.train):,} interactions",flush=True)
        model.fit(split.train); metrics=evaluate(model,split.train,split.test,k)
        rows.append({"model":name,"scenario":"all_test","train_interactions":len(split.train),"valid_interactions":len(split.valid),"test_interactions":len(split.test),"cold_test_users":len(cold_users),"cold_test_items":len(cold_items),**metrics})
        if cold_users:
            cold=split.test[split.test.user_id.isin(cold_users)]; rows.append({"model":name,"scenario":"cold_user","train_interactions":len(split.train),"valid_interactions":len(split.valid),"test_interactions":len(cold),"cold_test_users":len(cold_users),"cold_test_items":len(cold_items),**evaluate(model,split.train,cold,k)})
        if cold_items:
            cold=split.test[split.test.item_id.isin(cold_items)]; rows.append({"model":name,"scenario":"cold_item_unseen_catalog","train_interactions":len(split.train),"valid_interactions":len(split.valid),"test_interactions":len(cold),"cold_test_users":len(cold_users),"cold_test_items":len(cold_items),**evaluate(model,split.train,cold,k)})
        warm=split.test[~split.test.item_id.isin(cold_items)]
        if len(warm): rows.append({"model":name,"scenario":"warm_item","train_interactions":len(split.train),"valid_interactions":len(split.valid),"test_interactions":len(warm),"cold_test_users":len(cold_users),"cold_test_items":len(cold_items),**evaluate(model,split.train,warm,k)})
        pd.DataFrame(rows).to_csv(output/"metrics.csv",index=False)
        print(f"Finished {name}",flush=True)
    result=pd.DataFrame(rows); result.to_csv(output/"metrics.csv",index=False)
    with (output/"split_summary.json").open("w",encoding="utf-8") as f:
        import json; json.dump({"train":len(split.train),"validation":len(split.valid),"test":len(split.test),"users":events.user_id.nunique(),"items":events.item_id.nunique(),"cold_users":len(cold_users),"cold_items":len(cold_items),"k":k},f,indent=2)
    print(result.to_string(index=False))


def run_seeds(data: Path, output: Path, seeds: list[int], k=10, epochs=15):
    """Run the benchmark once per seed and write mean/std per model and scenario to metrics_mean_std.csv."""
    frames = []
    for seed in seeds:
        seed_dir = output / f"seed_{seed}"
        run(data, seed_dir, k, epochs, seed)
        frame = pd.read_csv(seed_dir / "metrics.csv"); frame["seed"] = seed; frames.append(frame)
    allruns = pd.concat(frames, ignore_index=True); allruns.to_csv(output / "metrics_all_seeds.csv", index=False)
    cols = [f"Recall@{k}", f"NDCG@{k}", f"HitRate@{k}", "Coverage"]
    summary = allruns.groupby(["model", "scenario"])[cols].agg(["mean", "std"])
    summary.columns = [f"{a}_{b}" for a, b in summary.columns]
    summary.reset_index().to_csv(output / "metrics_mean_std.csv", index=False)
    print(summary.to_string())


if __name__=="__main__":
    parser=argparse.ArgumentParser(); parser.add_argument("--data",type=Path,required=True); parser.add_argument("--output",type=Path,default=Path("app/data/eval/recommender")); parser.add_argument("--k",type=int,default=10); parser.add_argument("--epochs",type=int,default=15); parser.add_argument("--seeds",type=int,nargs="+",help="run several seeds and report mean/std"); args=parser.parse_args()
    if args.seeds: run_seeds(args.data,args.output,args.seeds,args.k,args.epochs)
    else: run(args.data,args.output,args.k,args.epochs)