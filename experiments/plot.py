"""Render only actual experiment results, no fabricated UI screenshots."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

root = Path(__file__).resolve().parent
out = root.parent / 'docs' / 'assets'
out.mkdir(parents=True, exist_ok=True)
q = json.loads((root / 'results' / 'quant.json').read_text(encoding='utf-8'))
plt.rcParams.update({'font.family':'DejaVu Sans','axes.spines.top':False,'axes.spines.right':False,'figure.facecolor':'#f7faf9','axes.facecolor':'#f7faf9','axes.titleweight':'bold','axes.labelcolor':'#203936','text.color':'#203936','svg.fonttype':'none'})
colors=['#8b9d9a','#a8b6b3','#97acc1','#9a8eaf','#147d6b','#c09c57','#b56d68','#7294b3']
def save(fig, name):
    fig.savefig(out / f'{name}.svg', bbox_inches='tight')
    fig.savefig(out / f'{name}.png', dpi=150, bbox_inches='tight')
    plt.close(fig)

fig, axs=plt.subplots(1,3,figsize=(15,4.4),sharey=True)
selected=['always_up','train_majority','persistence','trend','ensemble']
for ax,a in zip(axs,q['aggregates']):
    rows=[next(m for m in a['methods'] if m['method']==k) for k in selected]
    xs=np.arange(len(rows));ys=np.array([r['accuracy']*100 for r in rows])
    ax.bar(xs,ys,color=colors[:5],width=.65)
    ax.errorbar(xs,ys,yerr=np.array([[ys[i]-r['ci'][0]*100 for i,r in enumerate(rows)],[r['ci'][1]*100-ys[i] for i,r in enumerate(rows)]]),fmt='none',ecolor='#203936',capsize=3)
    ax.axhline(50,color='#bdc8c5',linestyle='--');ax.set_ylim(35,70)
    ax.set_xticks(xs,['Always\nup','Train\nmajority','Last\ndirection','Trend','3-rule\nvote'])
    ax.set_title(f"{a['horizon']}-day horizon | n={rows[0]['n']:,}")
    for x,y,r in zip(xs,ys,rows):ax.text(x,r['ci'][1]*100+1,f'{y:.1f}',ha='center',fontsize=9)
axs[0].set_ylabel('Directional accuracy (%)')
fig.suptitle('Held-out direction tests across 12 preselected assets',fontsize=17,y=1.04)
fig.text(.5,-.07,'Error bars: 95% month-cluster bootstrap intervals. Price rules only; these are not LLM forecast results.',ha='center',fontsize=10)
save(fig,'direction')

fig,ax=plt.subplots(figsize=(10,4.6))
a=q['aggregates'][1];rows=[m for m in a['methods'] if m['method'] in ['trend','ensemble','without_trend','without_momentum','without_reversal']]
for i,r in enumerate(rows):
    gain=r['gainVsUp']*100;lo,hi=[x*100 for x in r['pairedCI']]
    ax.errorbar(gain,i,xerr=[[gain-lo],[hi-gain]],fmt='o',capsize=5,color='#147d6b')
ax.axvline(0,color='#b56d68',linestyle='--');ax.set_yticks(range(len(rows)),[r['method'].replace('_',' ').title() for r in rows]);ax.invert_yaxis();ax.set_xlabel('Accuracy difference vs always-up (percentage points)');ax.set_title('Ablation at a fixed 5-day horizon')
fig.text(.5,-.025,'Paired calendar-month bootstrap. Intervals crossing zero do not establish an advantage.',ha='center',fontsize=10)
save(fig,'ablation')

fig,axs=plt.subplots(1,2,figsize=(12,4.5));methods=['always_up','trend','ensemble','ensemble_risk'];labels=['Buy & hold','Trend / cash','Vote / cash','Vote + risk gate']
for fee in [0,10,30]:
    rr=[];dd=[]
    for method in methods:
        rows=[next(r for r in next(t for t in a['tests'] if t['horizon']==5)['trading'] if r['method']==method and r['feeBps']==fee) for a in q['assets']]
        rr.append(np.median([r['cagr']*100 for r in rows]));dd.append(np.median([r['maxDrawdownAtBlockBoundaries']*100 for r in rows]))
    for ax,ys in zip(axs,[rr,dd]):ax.plot(labels,ys,marker='o',label=f'{fee} bps / turnover',linewidth=2)
axs[0].set_title('Median asset annualized return (%)');axs[1].set_title('Median block-boundary drawdown (%)')
for ax in axs:ax.tick_params(axis='x',rotation=12);ax.axhline(0,color='#bdc8c5');ax.legend(fontsize=8)
fig.suptitle('Next-open long / cash execution | 5-day decisions',fontsize=16,y=1.05)
fig.text(.5,-.04,'Per-asset medians, not an investable cross-currency portfolio. Drawdowns between 5-day observations can be larger.',ha='center',fontsize=10)
save(fig,'costs-risk')

fig,axs=plt.subplots(2,3,figsize=(13,6.6))
for ax,a in zip(axs.flat,[q['assets'][i] for i in [0,1,2,3,6,9]]):
    rows=next(t for t in a['tests'] if t['horizon']==5)['trading']
    for method,label,color in zip(['always_up','ensemble','ensemble_risk'],['Buy & hold','Vote / cash','Vote + risk'],['#8b9d9a','#147d6b','#c09c57']):
        r=next(r for r in rows if r['method']==method and r['feeBps']==10)
        ax.plot([x['value'] for x in r['curve']],label=label,color=color)
    ax.set_title(a['symbol']);ax.set_xlabel('Held-out 5-day blocks');ax.set_ylabel('Normalized wealth')
handles,labels=axs[0,0].get_legend_handles_labels();fig.legend(handles,labels,loc='upper center',ncol=3,bbox_to_anchor=(.5,1.04))
fig.tight_layout();save(fig,'wealth')

audit_path=root/'results'/'llm-audit.json'
if audit_path.exists():
    audit=json.loads(audit_path.read_text(encoding='utf-8'));fig,axs=plt.subplots(1,3,figsize=(13,4))
    rows=audit['results'];xs=np.arange(3);names=[r['fixture'] for r in rows if r['architecture']=='single']
    for arch,color,shift in [('single','#8b9d9a',-.18),('committee','#147d6b',.18)]:
        rr=[r for r in rows if r['architecture']==arch]
        for ax,values in zip(axs,[[r['evaluation']['score']*100 for r in rr],[r['usage']['total_tokens']/1000 for r in rr],[r['latencyMs']/1000 for r in rr]]):ax.bar(xs+shift,values,width=.34,color=color,label=arch)
    for ax,title in zip(axs,['Controlled checks passed (%)','Total tokens (thousands)','Wall time (seconds)']):ax.set_title(title);ax.set_xticks(xs,['Cash gap','Bank','TTM']);ax.legend(fontsize=8)
    axs[0].set_ylim(0,110);fig.suptitle('One live run per architecture on three synthetic cases',y=1.08,fontsize=16)
    fig.text(.5,-.06,'Same model, different roles. Small diagnostic sample; no claim of statistical superiority or future returns.',ha='center',fontsize=10)
    save(fig,'llm-audit')
print('Rendered experiment charts:', out)
