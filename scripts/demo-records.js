// Synthetic fixture only. Designed to demonstrate an exercise/sleep association.
export function demoRecords(end) {
  let seed=93741;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const rows=[];
  for(let i=0;i<30;i++) {
    const date=new Date(end+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-29+i);
    const active=[2,5,9,12,16,20,23,27].includes(i);
    const exercise=active?30+Math.floor(random()*16):Math.floor(random()*9);
    const previous=exercise;
    const sleep=Number(((previous>=30?7.5:5.4)+(random()-0.5)*0.6).toFixed(1));
    rows.push({date:date.toISOString().slice(0,10),exercise,exercise_type:exercise?'Walking':'None',
      caffeine:80+Math.floor(random()*5)*20,intake:'10:00',screen:Number((2+random()*2).toFixed(1)),water:Number((1.5+random()).toFixed(2)),
      sleep,sleep_quality:previous>=30?4:2,mood:previous>=30?4:2});
  }
  return rows;
}
