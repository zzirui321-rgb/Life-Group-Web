(() => {
  const explorer = document.querySelector('[data-mode-explorer]');
  if (!explorer) return;
  const en = document.documentElement.lang.startsWith('en');
  const copy = {"zh":{"titles":["它以什么节奏振荡？","它会变强，还是逐渐消失？","它在空间中是什么样子？","它在这段数据中有多显著？"],"texts":["同一个信号里可以叠加快慢不同的振荡。模态频率把这些节奏分开，帮助我们连接动力学与能带色散。","有些模式被放大，有些随时间衰减。增长率或衰减率描述这个趋势；它与振荡频率是不同的信息。","模态不仅有频率，也有空间分布。它可能集中在局部，也可能延展到整个系统；图中画出两种示意形状。","重构时，各模态以不同系数叠加。权重反映给定数据和模态归一化下的贡献大小，不等同于普适的重要性排名。"],"labels":["频率","增长 / 衰减","空间形状","权重"]},"en":{"titles":["How fast does it oscillate?","Does it grow or fade away?","What does it look like in space?","How much does it contribute to these data?"],"texts":["A signal can combine slow and fast oscillations. Modal frequencies separate these rhythms and help connect dynamics to band dispersion.","Some modes are amplified while others decay. A growth or decay rate describes this trend; it carries different information from an oscillation frequency.","A mode has a spatial distribution as well as a frequency. It may be localized or extended; the diagram shows two illustrative profiles.","Reconstruction combines modes with different coefficients. Weights describe their contribution for a given dataset and mode normalization, rather than a universal ranking of importance."],"labels":["Frequency","Growth / decay","Spatial profile","Weight"]}};
  const words = en ? copy.en : copy.zh;
  const buttons = [...explorer.querySelectorAll('[data-mode]')];
  const ns = 'http://www.w3.org/2000/svg';
  const shapes = explorer.querySelector('#mode-shapes');
  function element(tag, attributes) {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    shapes.append(node);
    return node;
  }
  function curve(fn, className) {
    const d = Array.from({length:241}, (_, i) => {
      const x = i / 240;
      return (i ? 'L' : 'M') + (40 + x*820).toFixed(2) + ' ' + fn(x).toFixed(2);
    }).join(' ');
    element('path', {d, class:className});
  }
  function draw(mode) {
    shapes.replaceChildren();
    if (mode === 0) {
      curve(x => 75 - 32*Math.cos(x*Math.PI*4), 'ai-plot-a');
      curve(x => 141 - 25*Math.cos(x*Math.PI*10), 'ai-plot-b');
    } else if (mode === 1) {
      curve(x => 180 - 18*Math.exp(2*x), 'ai-plot-a');
      curve(x => 180 - 135*Math.exp(-3*x), 'ai-plot-b');
    } else if (mode === 2) {
      curve(x => 180 - 135*Math.exp(-Math.pow((x-.5)/.12,2)), 'ai-plot-a');
      curve(x => 180 - 45*Math.pow(Math.sin(3*Math.PI*x),2), 'ai-plot-b');
    } else {
      [130,82,34].forEach((height,i) => {
        element('rect', {x:150+i*240, y:185-height, width:120, height, rx:6, class:'ai-plot-bar'});
        element('text',{x:210+i*240,y:210,'text-anchor':'middle'}).textContent=(en?'Mode ':'模态 ')+(i+1);
      });
    }
    explorer.querySelector('#mode-axis-label').textContent = mode===3 ? '' : mode===2 ? (en?'Position →':'位置 →') : (en?'Time →':'时间 →');
    explorer.querySelector('#mode-plot-title').textContent = words.labels[mode] + (en?' — illustrative curves':'：示意曲线');
  }
  function select(mode) {
    buttons.forEach(button => button.setAttribute('aria-pressed',String(Number(button.dataset.mode)===mode)));
    explorer.querySelector('#mode-heading').textContent = words.titles[mode];
    explorer.querySelector('#mode-description').textContent = words.texts[mode];
    draw(mode);
    const legends = en ? [['Slow oscillation','Fast oscillation'],['Growth','Decay'],['Localized profile','Extended profile'],['Illustrative modal coefficients']] : [['慢振荡','快振荡'],['增长','衰减'],['局域形状','扩展形状'],['模态系数的示意大小']];
    const legend = explorer.querySelector('#mode-legend');
    legend.replaceChildren(...legends[mode].map((text, i) => {
      const item = document.createElement('span');
      item.className = i ? 'ai-legend-b' : 'ai-legend-a';
      item.textContent = text;
      return item;
    }));
  }
  buttons.forEach(button => button.addEventListener('click', () => select(Number(button.dataset.mode))));
  select(0);
})();
