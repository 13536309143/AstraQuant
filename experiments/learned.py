"""Expanding-window logistic forecasts. All fit/normalization inputs precede the forecast.
No parameter search, no random split and no LLM input. Uses local data from run.mjs.
"""
import json, math, hashlib
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path(__file__).resolve().parent
project = root.parent
manifest = json.loads((root/'results'/'quant.json').read_text(encoding='utf-8'))
records, assets = [], []

def sigmoid(z):
    return 1/(1+np.exp(-np.clip(z,-30,30)))

def fit(x,y):
    mu=x.mean(axis=0); scale=np.maximum(x.std(axis=0),1e-8)
    z=np.column_stack([np.ones(len(x)),(x-mu)/scale])
    w=np.zeros(z.shape[1]); w[0]=math.log((y.mean()+1e-6)/(1-y.mean()+1e-6))
    # Fixed L2 and optimization steps, chosen before this run, never grid-searched.
    for _ in range(200):
        grad=z.T@(sigmoid(z@w)-y)/len(y)+.01*np.r_[0,w[1:]]
        w-=.08*grad
    return mu,scale,w

def features(c,t):
    tail=c[t-200:t+1]; r=np.diff(np.log(tail[-21:])); d=np.diff(tail[-15:]); gain=np.maximum(d,0).sum();loss=np.maximum(-d,0).sum()
    rsi=.5 if gain+loss==0 else gain/(gain+loss)
    return [c[t]/c[t-k]-1 for k in [1,5,20,60]]+[c[t]/tail[-20:].mean()-1,c[t]/tail[-50:].mean()-1,tail[-50:].mean()/tail[-200:].mean()-1,r.std()*np.sqrt(252),rsi]

def metrics(rows,method):
    valid=[r for r in rows if r['actual']!=0]; y=np.array([r['actual']>0 for r in valid]);p=np.array([r['probabilities'][method] for r in valid]);guess=p>=.5
    balanced=(np.mean(guess[y])+np.mean(~guess[~y]))/2 if y.any() and (~y).any() else None
    probabilistic=method in ['logistic','expanding_prior']
    return {'method':method,'n':len(valid),'accuracy':float(np.mean(guess==y)),'balancedAccuracy':float(balanced) if balanced is not None else None,'brier':float(np.mean((p-y)**2)) if probabilistic else None,'logLoss':float(-np.mean(y*np.log(np.maximum(p,1e-9))+(1-y)*np.log(np.maximum(1-p,1e-9)))) if probabilistic else None}

for source in manifest['assets']:
    p=project/'data'/'experiments'/(source['symbol'].replace(':','_')+'.json')
    raw=p.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=source['sha256']:
        raise ValueError('Input hash changed: '+source['symbol'])
    bars=json.loads(raw);c=np.array([b['close'] for b in bars]);n=len(c);split=max(300,int(n*.6));x=np.array([features(c,t) for t in range(200,n)])
    corrupted=c.copy();corrupted[split+1:]*=100
    assert np.allclose(features(c,split),features(corrupted,split)), 'Future prices leaked into features'
    local=[]
    for h in [1,5,20]:
        last_fit=-10000; params=None; trained_through=None; prior=None
        for t in range(split,n-h-1,h):
            if t-last_fit>=20:
                # A training row j is legal only if its target j+h closes strictly before t.
                train=np.arange(200,t-h)
                ys=np.sign(c[train+h]/c[train]-1);keep=ys!=0;train=train[keep];ys=(ys[keep]>0).astype(float)
                params=fit(x[train-200],ys);prior=float(ys.mean());trained_through=bars[int(train[-1])+h]['time'];last_fit=t
                assert trained_through<bars[t]['time']
            mu,scale,w=params;prob=float(sigmoid(np.r_[1,(x[t-200]-mu)/scale]@w));actual=int(np.sign(c[t+h]/c[t]-1))
            trend=1.0 if c[t]>=c[t-49:t+1].mean() else 0.0
            row={'symbol':source['symbol'],'horizon':h,'date':bars[t]['time'],'targetDate':bars[t+h]['time'],'trainedThrough':trained_through,'actual':actual,'probabilities':{'logistic':prob,'expanding_prior':prior,'always_up':1.0,'trend':trend}}
            records.append(row);local.append(row)
    assets.append({'symbol':source['symbol'],'metrics':[{**metrics([r for r in local if r['horizon']==h],m),'horizon':h} for h in [1,5,20] for m in ['logistic','expanding_prior','always_up','trend']]})
    print('walk-forward',source['symbol'],len(local))

aggregates=[]
for h in [1,5,20]:
    rr=[r for r in records if r['horizon']==h];groups={}
    for r in rr:
        if r['actual']!=0:groups.setdefault(r['date'][:7],[]).append(r)
    blocks=list(groups.values());rng=np.random.default_rng(19871019)
    delta=[];interval=[]
    for _ in range(1000):
        sample=[r for i in rng.integers(0,len(blocks),len(blocks)) for r in blocks[i]]
        a=metrics(sample,'logistic')['accuracy'];b=metrics(sample,'expanding_prior')['accuracy'];interval.append(a);delta.append(a-b)
    aggregates.append({'horizon':h,'methods':[metrics(rr,m) for m in ['logistic','expanding_prior','always_up','trend']],'logisticAccuracyCI':np.quantile(interval,[.025,.975]).tolist(),'pairedGainVsPriorCI':np.quantile(delta,[.025,.975]).tolist()})

result={'generatedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'scope':'Retrospective expanding-window logistic regression. Added after seeing fixed-rule results; not a preregistered blind experiment. Not the eight-role LLM system. No parameter search. No future rows in fitting, labels or standardization.','parameters':{'features':['return1','return5','return20','return60','gapMA20','gapMA50','MA50vs200','volatility20','simpleRSI14'],'l2':.01,'gradientSteps':200,'learningRate':.08,'refitEveryBars':20,'firstTrainingFraction':.6,'decisionThreshold':.5},'aggregates':aggregates,'assets':assets}
(root/'results'/'walk-forward.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Row-level audit trail is local; aggregate scores and train/target windows are public.
(project/'data'/'experiments'/'walk-forward-records.json').write_text(json.dumps(records),encoding='utf-8')

plt.rcParams.update({'font.family':'DejaVu Sans','figure.facecolor':'#f7faf9','axes.facecolor':'#f7faf9','axes.spines.top':False,'axes.spines.right':False,'svg.fonttype':'none'})
fig,axs=plt.subplots(1,3,figsize=(14,4.4),sharey=True)
for ax,a in zip(axs,aggregates):
    rows=a['methods'];xs=np.arange(len(rows));ys=[r['accuracy']*100 for r in rows]
    ax.bar(xs,ys,color=['#147d6b','#a8b6b3','#8b9d9a','#97acc1'])
    low,high=[v*100 for v in a['logisticAccuracyCI']];ax.errorbar(0,ys[0],yerr=[[ys[0]-low],[high-ys[0]]],fmt='none',ecolor='#203936',capsize=4)
    for i,y in enumerate(ys):ax.text(i,(high if i==0 else y)+1,f'{y:.1f}',ha='center',fontsize=9)
    ax.axhline(50,color='#bdc8c5',linestyle='--');ax.set_ylim(35,75);ax.set_xticks(xs,['Learned\nlogistic','Expanding\nprior','Always\nup','Trend']);ax.set_title(f"{a['horizon']}-day horizon | n={rows[0]['n']:,}")
axs[0].set_ylabel('Held-out directional accuracy (%)');fig.suptitle('Learning from past data: expanding-window forecasts',fontsize=16,y=1.05)
fig.text(.5,-.07,'Training labels and normalization strictly precede each forecast. Retrospective, not prospective validation.',ha='center',fontsize=10)
out=project/'docs'/'assets';fig.savefig(out/'walk-forward.png',dpi=150,bbox_inches='tight');fig.savefig(out/'walk-forward.svg',bbox_inches='tight');plt.close(fig)
print(json.dumps(aggregates,indent=2))
