const assert=require('node:assert/strict');
const {timeline,wrapText,STYLE}=require('../media-service/compositor.cjs');
for(const duration of [8,12,16,30]){const shots=timeline(duration);assert.equal(shots.length,4);assert.equal(shots[3].end,duration);const frames=shots.reduce((n,s)=>n+s.sourceDuration,0)-3*shots[0].transition;assert(Math.abs(frames-duration)<1e-8);assert(shots.every(s=>s.end>s.start));}
assert.equal(wrapText(''), '');
assert(wrapText('真实商品参数和提供的事实应该保持原样不能虚构').includes('\n'));
assert.equal(wrapText("100% : 'literal'"),"100% : 'literal'");
assert(wrapText('W'.repeat(80)).split('\n').every(line=>line.length<=13));
assert.equal(STYLE,'editorial-motion-v1');
console.log('PASS compositor timeline, literal text wrapping and style contract');
