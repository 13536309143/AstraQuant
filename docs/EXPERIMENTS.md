# 实验报告｜Experiment report

**实验日期 / Run date:** 2026-10-15。所有图表来自仓库中的实测结果文件；没有生成示意收益或伪造 UI 截图。 / Charts are rendered from recorded result files, not illustrative returns or fabricated screenshots.

## 1. 研究问题｜Questions

1. 固定技术信号能否在未用于设定训练基准的后段样本中预测涨跌？ / Can fixed technical rules predict direction in a held-out chronological segment?
2. 三规则组合是否比简单基准或去掉部分规则更好？ / Does the three-rule vote outperform simple baselines or ablations?
3. 交易成本与风险过滤怎样影响模拟结果？ / How do turnover costs and a risk gate affect simulated results?
4. 同一模型的八角色流程能否更可靠地处理受控财务证据？费用怎样变化？ / Does an eight-role workflow process controlled financial evidence more reliably, and at what cost?

**边界 / Scope:** 前三个问题评估独立的确定性价格规则模块 `lib/forecast.mjs`；第四个是简化结构化财务审计。两者都不是完整应用的真实账户收益验证，也不能证明未来表现。 / The first three test a separate deterministic price-rule module. The fourth is a simplified structured audit. Neither validates live portfolio returns or proves future performance of the full application.

## 2. 方向预测｜Directional tests

![Direction tests](assets/direction.png)

### 数据与时间顺序｜Data and chronology

固定样本：沪深 300、恒生、标普 500，以及茅台、平安银行、宁德时代、腾讯、中国移动、阿里巴巴、Apple、Microsoft、NVIDIA，共 12 个标的。该便利样本偏向知名、存续的大型标的，不能代表完整市场。 / The fixed universe contains three indices and nine familiar surviving large-cap equities; it is a convenience sample, not a representative market universe.

每标的请求最近最多 1,500 个日 K，排除 UTC 当日及之后的 K 线，拒绝过期缓存，保留约 1,499–1,500 条。前 60% 只用于“训练期多数方向”基准；后 40% 用于评估。没有拟合模型、搜索参数或根据测试结果选择最佳规则。 / Up to 1,500 daily bars are requested per asset. Current/future UTC-day bars and stale caches are excluded. The first 60% supplies the majority-sign baseline; the final 40% is evaluated. No model fitting, parameter search or winner selection is performed.

测试开始日期约为：A 股 2024-04-22、港股 2024-05-08、美股 2024-05-23；结束日期 2026-10-14。精确区间、请求 URL、抓取时间及输入 SHA256 见 [quant.json](../experiments/results/quant.json)。 / Exact per-asset windows and provenance are recorded in quant.json.

测试是按时间向前逐点生成固定规则预测；不是滚动重训练模型。每个标的/跨度以跨度长度步进，目标区间不重叠。跨标的相关性和不同跨度相关性仍然存在。 / Fixed predictions are generated sequentially without future bars; this is not rolling model retraining. Targets do not overlap within an asset/horizon. Dependence across assets and horizons remains.

### 信号与基准｜Rules and baselines

- 趋势 / Trend：收盘价相对 50 日均线的方向。 / Close versus its trailing 50-day mean.
- 动量 / Momentum：过去 20 日涨跌方向。 / Trailing 20-day return sign.
- 反转 / Reversal：最近 14 个变动的简单均值 RSI，低于 45 看涨，高于 55 看跌，其余中性。它与界面 Wilder RSI 的平滑口径不同。 / Simple-window RSI of the last 14 changes, with 45/55 thresholds; this differs from the UI's Wilder-smoothed RSI.
- 三规则投票 / Vote：三者符号相加，平票记看涨；不是概率。 / Sum of signs, with ties assigned up; this is not a calibrated probability.
- 基准 / Baselines：始终看涨、训练段多数方向、上一日方向、单独趋势。 / Always up, training-segment majority sign, last-day sign and trend alone.

目标为 `close[t+h]/close[t]-1` 的符号，零变动不计入方向准确率。提供 accuracy 与 balanced accuracy；只看 accuracy 可能被上涨比例误导。 / Targets are forward close-return signs, excluding exact zeros. Both accuracy and balanced accuracy are reported.

| 跨度 Horizon | N | 投票准确率 Vote accuracy | 约 95% 区间 Approx. 95% CI | 始终看涨 Always up | 投票平衡准确率 Vote balanced accuracy |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 日 / day | 7,107 | 49.50% | 48.05–50.89% | 50.84% | 49.33% |
| 5 日 / days | 1,424 | 48.53% | 44.55–52.89% | 52.60% | 47.94% |
| 20 日 / days | 348 | 47.41% | 41.56–53.65% | 56.90% | 45.87% |

区间按自然月聚合所有标的，然后进行 1,000 次簇 bootstrap，固定随机种子。月份数量有限，这只是近似区间；没有多重比较校正。原始精度数字以结果文件为准。 / Intervals resample calendar-month clusters across assets 1,000 times with a fixed seed. They are approximate, have few time clusters and are not multiplicity-adjusted.

**结论 / Finding:** 当前投票在三个跨度都落后于始终看涨基准，不能据此宣称可稳定预测走向。 / The vote trails the always-up baseline at all three horizons. Stable predictive ability is not demonstrated.

## 3. 消融｜Ablation

![Ablation](assets/ablation.png)

分别移除趋势、动量或反转规则，保留其余规则、样本和时间划分，比较与始终看涨的准确率差。区间来自同一自然月重采样的配对差值。 / Each signal is removed while keeping other rules and observations fixed. Paired month resampling estimates accuracy differences against always-up.

部分删减组合在某些跨度表现较高，但不把后验较好的组合升级为已验证策略。多数配对区间包含零；较高 accuracy 也可能来自更加偏向看涨。未来若选择规则，必须在新的未见样本重新检验。 / Some ablations look better at particular horizons. They are not promoted to validated strategies after observing the results. Most paired intervals include zero, and accuracy can rise through bullish bias. Any selected rule needs fresh unseen data.

## 4. 成本、回撤与执行｜Costs, drawdowns and execution

![Cost/risk sensitivity](assets/costs-risk.png)
![Per-asset wealth](assets/wealth.png)

决策在 t 收盘后生成，t+1 开盘进场，持有 h 个交易日，t+h+1 开盘再平衡；只做多或持有现金。比较持有、趋势/现金、投票/现金、投票+风险过滤。风险过滤在 20 日历史波动年化大于 60% 或价格低于 200 日均线时转为现金。 / Decisions follow close t, execute at open t+1 and rebalance after h sessions. Strategies are long/cash. The risk gate selects cash above 60% trailing annualized volatility or below the 200-day mean.

单边换仓成本为 0/10/30 bps，首笔与期末清仓也计费。连续持有不重复收取双边费用。资金曲线按每次决策区间记账。不同币种资产独立计算，再展示中位数，不构造虚假的跨币种组合。 / Turnover costs are 0/10/30 bps per one-way position change, including entry and terminal exit. Unchanged positions incur no turnover. Wealth is tracked at decision boundaries; per-asset medians are not a cross-currency portfolio.

回撤只在 h 日观测点计算，不能代替每日或盘中最大回撤。年化按 252 个交易日。未模拟现金利息、税率差异、汇率、流动性、开盘无法成交、停牌/涨跌停约束、股息再投资或真实冲击成本。指数本身也不能直接交易。 / Drawdowns are measured only at h-day boundaries, not daily/intraday. Annualization uses 252 sessions. The simulation omits cash yield, market-specific taxes, FX, liquidity, unfillable opens, suspensions/limits, reinvested distributions and realistic impact. Indices are not directly tradable.

历史前复权数据可能因后续公司行为修订；当前获得的序列不是点时归档。模拟中使用归一化收益不等于现实可成交总回报。 / Adjusted histories can be revised after corporate actions and are not point-in-time archives. Normalized simulated returns are not realized total returns.

## 5. 八角色证据审计｜Eight-role evidence audit

![LLM audit](assets/llm-audit.png)

使用真实 MiniMax-M3 调用，在三个公开的**合成证据**案例中比较单次回答与“六角色 → 审查 → 综合”。这不是历史股价预测，没有真实公司名称。每案例每架构仅一次；没有选择性重跑。 / Live MiniMax-M3 calls compare one response with six roles, skeptic and synthesis on three **synthetic** cases. This is not a historical-price forecast. Each architecture runs once per case, with no selective retries of failed scores.

案例与标准答案见 [fixtures.mjs](../experiments/fixtures.mjs)。检查：8 项数值/布尔/null 字段、来源 ID 是否属于允许集合、缺失项列表是否使用明确要求的字段名。来源检查仅验证编号集合，不验证来源语义。 / Gold labels check eight scalar fields, permitted source IDs and the explicitly requested missing-field names. Source checks validate IDs, not semantic entailment.

| 案例 Case | 单次 Single | 八角色 Committee | 观察 Observation |
| --- | ---: | ---: | --- |
| 正利润但负现金流 / Positive profit, negative CFO | 10/10 | 10/10 | 两者都识别现金流缺口，并拒绝材料中的 ESG 注入指令 / Both handled the cash gap and ignored the injected ESG instruction |
| 银行业口径 / Banking exception | 8/10 | 9/10 | 单次把银行通用负债提示写成 null；两者缺失项命名未按严格格式 / Single used null for the bank exception; both missed strict naming requirements |
| 累计报表桥接 TTM / Cumulative-to-TTM bridge | 8/10 | 10/10 | 协作完成 110/30 的桥接；单次保留为 null / Committee computed the 110/30 bridge; single left it unknown |
| 合计 Total | **26/30 (86.7%)** | **29/30 (96.7%)** | 三案例内的描述性结果 / Descriptive results within these cases |

| 成本项 Cost | 单次合计 Single total | 协作合计 Committee total |
| --- | ---: | ---: |
| 模型调用 Calls | 3 | 24 |
| 返回的 usage token / Reported tokens | 1,589 | 16,209 |
| 案例耗时之和 / Sum of case wall times | 约 12.2 秒 / seconds | 约 146.2 秒 / seconds |

完整请求状态、逐项结果、输出、用量与耗时见 [llm-audit.json](../experiments/results/llm-audit.json)。这些是模型返回的 token 统计，不是账单金额；环境限流、缓存及并发影响耗时。 / The result file retains statuses, checks, outputs, usage and timings. Tokens are provider-reported usage, not monetary charges; latency depends on rate limits, caching and concurrency.

**结论 / Finding:** 本次协作修正了一些行业与 TTM 问题，代价为约 10.2 倍 token、12 倍案例总耗时。检查项相关、样本极小，严格命名失误也计入评分；不能做显著性结论或推断真实投资效果。 / The committee corrected some sector and TTM issues at about 10.2× tokens and 12× summed case latency. Checks are dependent, sample size is tiny and strict naming errors count. No statistical superiority or investment benefit is established.

## 6. 复现｜Reproduction

```bash
# Node.js 24+, project root. No API key needed for price tests.
npm run experiments

# Configure .env first. This makes billable model calls.
npm run experiment:llm

# Optional chart rendering; tested with Python 3.14 + Matplotlib 3.11
python -m pip install -r experiments/requirements.txt
python experiments/plot.py
```

Windows 可用 `npm.cmd` 和 `py -3.14`。`quant.json`、`direction.csv`、`llm-audit.json` 为聚合公开结果；原始行情写入忽略的 `data/experiments/`。供应商修订数据、滚动窗口、模型更新及随机性会使重新运行的结果不同。SHA256 用于核对本次输入，不保证以后能够从数据商取回相同序列。 / Windows may use npm.cmd and py -3.14. Raw market inputs stay under ignored data/. Rolling windows, vendor revisions, model updates and randomness can change reruns. Hashes identify this run's input, not future data availability.

## 7. 从历史学习，再向前预测｜Learn from history, then forecast forward

![Expanding-window learned forecast](assets/walk-forward.png)

按用户提出的历史实验证明要求，额外加入了**按时间扩展训练的 L2 逻辑回归**。九个输入是过去 1/5/20/60 日收益、20/50 日均线偏离、50/200 日均线比、20 日波动和简单 RSI14。每标的独立训练、每 20 个交易日重新拟合，预测 1/5/20 日涨跌。

An additional **L2 logistic model with expanding chronological training** tests whether learning from prior prices improves forecasts. Nine trailing-price features are fitted separately per asset, with refits every 20 sessions and 1/5/20-day targets.

在时点 t，训练样本 j 必须满足 **j+h < t**，保证标签也已知；标准化均值、标准差只来自合法训练行。脚本断言训练标签结束日期早于预测日期，并测试篡改未来价格不改变当前特征。没有随机切分、没有在测试集上搜索参数。阈值固定 0.5，L2=0.01，固定 200 次梯度更新，步长 0.08。

At forecast t, training rows satisfy **j+h < t**, including target availability. Scaling uses legal training rows only. Assertions verify the time boundary and invariance of current features to changed future prices. There is no random split or test-set parameter search. Threshold, regularization and optimization settings are fixed in source.

| 跨度 Horizon | N | 逻辑回归 Learned | 扩展历史比例 Expanding prior | 始终看涨 Always up | 相对历史比例增益区间 Paired gain CI |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 日 / day | 7,107 | 51.40% | 51.96% | 50.84% | −1.70 到 +0.51 个百分点 / pp |
| 5 日 / days | 1,424 | 52.74% | 51.97% | 52.60% | −1.23 到 +3.03 pp |
| 20 日 / days | 348 | 53.16% | 53.74% | 56.90% | −6.11 到 +4.45 pp |

模型 Brier 误差为 0.2520 / 0.2532 / 0.2628，扩展历史比例基准为 0.2499 / 0.2494 / 0.2516，越低越好。没有把只输出涨/跌的规则基准当作 0%/100% 概率进行不公平的概率评分。模型输出未经独立概率校准，不能称为实际上涨胜率。

Model Brier errors are 0.2520 / 0.2532 / 0.2628 versus 0.2499 / 0.2494 / 0.2516 for the expanding prior; lower is better. Direction-only rules are not unfairly scored as certain 0%/100% probabilities. Logistic outputs are not independently calibrated win probabilities.

这个补充实验是在看过固定规则结果后新增的，因此属于**回顾性研究，并非预登记的盲测**。虽然每一次训练没有访问未来标签，但开发过程已经接触该历史区间，仍需要新的未见数据验证。结果没有支持稳定优于基准，不能用“准确率超过 50%”单独证明助手有效。

This experiment was added after reviewing fixed-rule results, so it is **retrospective, not a preregistered blind test**. Each fit avoids future labels, but development has already encountered the historical period. Fresh unseen data remains necessary. Accuracy above 50% alone does not establish usefulness or stable superiority.

复现 / Reproduce: 先 `npm run experiments`，安装 requirements，然后 `python experiments/learned.py`。聚合结果在 [walk-forward.json](../experiments/results/walk-forward.json)，逐条训练截止日期与目标留在本地 `data/experiments/walk-forward-records.json`。

## 8. 下一步验证｜Further validation

要支持更强结论，需要预先登记规则和样本池、保留不可修改的预测时间戳、获取点时/含退市标的的数据、控制行业与风格暴露、加入真实执行约束，并积累未用于开发的前瞻记录。完整研究流程还应在更大财务/公告问答集上重复评估引用语义、事实错误、漏项和人工复核时间。 / Stronger conclusions require preregistered rules/universes, immutable prospective predictions, point-in-time/delisted coverage, exposure controls, realistic execution and unseen forward observations. The full workflow also needs larger repeated evaluations of citation entailment, factual errors, omissions and human review time.
