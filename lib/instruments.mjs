export const INDICES=[
 {symbol:'IDX:SH000001',name:'上证指数',secid:'1.000001',market:'CN',currency:'CNY'},
 {symbol:'IDX:SZ399001',name:'深证成指',secid:'0.399001',market:'CN',currency:'CNY'},
 {symbol:'IDX:SZ399006',name:'创业板指',secid:'0.399006',market:'CN',currency:'CNY'},
 {symbol:'IDX:CSI300',name:'沪深300',secid:'1.000300',market:'CN',currency:'CNY'},
 {symbol:'IDX:CSI500',name:'中证500',secid:'1.000905',market:'CN',currency:'CNY'},
 {symbol:'IDX:CSI1000',name:'中证1000',secid:'1.000852',market:'CN',currency:'CNY'},
 {symbol:'IDX:SSE50',name:'上证50',secid:'1.000016',market:'CN',currency:'CNY'},
 {symbol:'IDX:STAR50',name:'科创50',secid:'1.000688',market:'CN',currency:'CNY'},
 {symbol:'IDX:BSE50',name:'北证50',secid:'0.899050',market:'CN',currency:'CNY'},
 {symbol:'IDX:HSI',name:'恒生指数',secid:'100.HSI',market:'HK',currency:'HKD'},
 {symbol:'IDX:HSCEI',name:'恒生国企',secid:'100.HSCEI',market:'HK',currency:'HKD'},
 {symbol:'IDX:HSTECH',name:'恒生科技',secid:'124.HSTECH',market:'HK',currency:'HKD'},
 {symbol:'IDX:SPX',name:'标普500',secid:'100.SPX',market:'US',currency:'USD'},
 {symbol:'IDX:DJIA',name:'道琼斯',secid:'100.DJIA',market:'US',currency:'USD'},
 {symbol:'IDX:NASDAQ',name:'纳斯达克指数',secid:'100.NDX',market:'US',currency:'USD'}
];
export const indexOf=s=>INDICES.find(i=>i.symbol===s);
export const isBenchmark=s=>!!indexOf(s)||/^BOARD:BK\d{4,6}$/.test(s);
