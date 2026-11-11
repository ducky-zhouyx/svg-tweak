// Run: node tests/arrows.cjs
const assert = require('node:assert/strict');
const { withEditor } = require('./browser.cjs');

withEditor(async ({ evalJS, send }) => {
  const result = await evalJS('(' + function () {
    const results = [], check = (ok, message) => { if (!ok) throw new Error(message); };
    const near = (actual, expected, message) => check(Math.abs(actual - expected) < .06, message + ': ' + actual + ' != ' + expected);
    const svg = content => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">' + content + '</svg>';
    const use = id => { const el = doc.querySelector('#' + id); select([el]); return el; };
    const marker = (el, side = 'end') => {
      const value = getComputedStyle(el).getPropertyValue('marker-' + side);
      const id = value.match(/#([^'"\s)]+)/)?.[1];
      return id ? [...doc.querySelectorAll('marker')].find(el => el.id === decodeURIComponent(id)) : null;
    };
    // Compare actual referenced path geometry in marker coordinates, whether a
    // definition still uses <use> or an edit has expanded its private copy.
    const glyph = mk => {
      const paths = [];
      function visit(el, parentMatrix) {
        const own = el.transform?.baseVal.consolidate()?.matrix;
        let matrix = own ? parentMatrix.multiply(own) : parentMatrix;
        if (el.localName === 'use') {
          const href = el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
          const target = href?.startsWith('#') && doc.getElementById(href.slice(1));
          check(!!target, 'marker glyph contains a broken use reference');
          matrix = matrix.translate(el.x.baseVal.value, el.y.baseVal.value);
          visit(target, matrix);
        } else if (el.localName === 'path') {
          paths.push([el.getAttribute('d'), ...['a','b','c','d','e','f'].map(key => Math.round(matrix[key] * 1e6) / 1e6)]);
        } else {
          [...el.children].forEach(child => visit(child, matrix));
        }
      }
      [...mk.children].forEach(child => visit(child, new DOMMatrix()));
      check(paths.length > 0, 'marker glyph must contain visible path geometry');
      return JSON.stringify(paths);
    };
    const visio = svg('<style>.visio-line{fill:none;stroke:#000;stroke-width:.75;marker-end:url(#visio-tip)}.visio-tip{fill:#000;stroke:#000;stroke-width:.22935779816514}</style>' +
      '<defs><g id="visio-glyph"><path d="M 2 1 L 0 0 L 1.98117 -0.993387 C 1.67173 -0.364515 1.67301 0.372641 1.98465 1.00043" style="stroke:none"/></g>' +
      '<marker id="visio-tip" class="visio-tip" refX="-7.63" orient="auto" markerUnits="strokeWidth" overflow="visible"><use href="#visio-glyph" transform="scale(-4.36 -4.36)"/></marker></defs>' +
      '<g id="wires"><path id="a" class="visio-line" d="M40 70H140"/><path id="b" class="visio-line" d="M40 140H140"/></g>');
    const loadVisio = () => { loadSVGText(visio, 'visio-arrows.svg'); flattenSelection(false, false); return use('a'); };

    let line = loadVisio(), original = marker(line), originalMarkup = original.outerHTML, originalGlyph = glyph(original);
    check(currentArrowState().end && !currentArrowState().start && $('btnArrowEnd').classList.contains('active'), 'CSS marker was not recognized');
    check($('inpArrowStyle').value === 'custom', 'imported shape must not pretend to be the built-in triangle');
    near(parseFloat($('inpArrowSize').value), 8.72, 'imported size is glyph width, not default marker viewport width');
    const depth = state.undo.length;
    toggleArrow('end');
    check(getComputedStyle(line).markerEnd === 'none' && line.style.getPropertyValue('marker-end') === 'none', 'turning off CSS marker must override the stylesheet');
    check(state.undo.length === depth + 1, 'arrow toggle should be one undo step');
    undo(); line = use('a'); check(currentArrowState().end && glyph(marker(line)) === originalGlyph && marker(line).getAttribute('refX') === original.getAttribute('refX'), 'undo did not restore imported arrow');
    redo(); line = use('a'); check(!currentArrowState().end, 'redo did not remove imported arrow');
    results.push('CSS marker detection, actual imported size and explicit removal with one-step undo/redo');

    line = loadVisio(); original = marker(line); originalMarkup = original.outerHTML;
    pushUndo(); setStyleForSelection('stroke', '#1256ab');
    let edited = marker(line);
    check(edited !== original && glyph(edited) === originalGlyph, 'color edit replaced the imported geometry');
    check(getComputedStyle(edited.querySelector('path')).fill === 'rgb(18, 86, 171)', 'imported arrow did not follow the line color');
    check(marker(doc.querySelector('#b')) === original && original.outerHTML === originalMarkup, 'editing one line changed the shared marker of another line');
    setArrowSize(12); edited = marker(line);
    check(glyph(edited) === originalGlyph, 'size edit replaced the imported geometry');
    near(parseFloat($('inpArrowSize').value), 12, 'resized arrow UI size');
    const vb = edited.viewBox.baseVal;
    near(8.72 * (vb.width ? edited.markerWidth.baseVal.value / vb.width : 1), 12, 'resized glyph render scale');
    check(original.outerHTML === originalMarkup, 'size edit mutated the unselected shared definition');
    setArrowPos('center'); setArrowOffset(1.25);
    check(glyph(marker(line)) === originalGlyph && $('inpArrowPos').value === 'center', 'alignment must preserve imported geometry');
    near(parseFloat($('inpArrowOffset').value), 1.25, 'selected marker offset must be read back');
    const exported = buildSVGString();
    loadSVGText(exported, 'arrow-roundtrip.svg'); line = use('a');
    check(currentArrowState().end && glyph(marker(line)) === originalGlyph, 'export/reload lost imported geometry or marker state');
    near(parseFloat($('inpArrowSize').value), 12, 'export/reload lost marker size');
    results.push('imported colors, size, alignment and offset preserve glyphs; shared definitions stay independent and export/reload');

    for (const paint of ['style="fill:none;stroke:#111;stroke-width:1"', 'class="hollow-use"']) {
      loadSVGText(svg('<style>.hollow-use{fill:none;stroke:#111;stroke-width:1}</style><defs><path id="unpainted-tip" d="M-8 -4L0 0L-8 4"/>' +
        '<marker id="hollow-tip" orient="auto" markerUnits="userSpaceOnUse" overflow="visible"><use href="#unpainted-tip" transform="scale(1.5 1.5)" ' + paint + '/></marker></defs>' +
        '<path id="a" d="M40 70H140" fill="none" stroke="#111" stroke-width="2" marker-end="url(#hollow-tip)"/>' +
        '<path id="b" d="M40 140H140" fill="none" stroke="#111" stroke-width="2" marker-end="url(#hollow-tip)"/>'), 'hollow-use-arrows.svg');
      line = use('a'); original = marker(line); originalMarkup = original.outerHTML;
      const source = doc.querySelector('#unpainted-tip'), sourceMarkup = source.outerHTML;
      const sourceMatrix = original.querySelector('use').transform.baseVal.consolidate().matrix;
      const length = source.getTotalLength();
      const expected = [0, .5, 1].map(t => new DOMPoint(source.getPointAtLength(length * t).x, source.getPointAtLength(length * t).y).matrixTransform(sourceMatrix));
      check(original.querySelector('use') && !original.querySelector('path'), 'hollow-use fixture must be tested before flattening');
      pushUndo(); setStyleForSelection('stroke', '#ab2456'); edited = marker(line);
      const path = edited.querySelector('path'), css = getComputedStyle(path);
      check(path.getAttribute('d') === source.getAttribute('d') && css.fill === 'none' && css.stroke === 'rgb(171, 36, 86)', 'use-level hollow paint was lost when recoloring ' + paint);
      let matrix = new DOMMatrix();
      for (let node = path; node !== edited; node = node.parentElement) {
        const transform = node.transform?.baseVal.consolidate(); if (transform) matrix = DOMMatrix.fromMatrix(transform.matrix).multiply(matrix);
      }
      expected.forEach((p, i) => {
        const actual = new DOMPoint(path.getPointAtLength(length * i / 2).x, path.getPointAtLength(length * i / 2).y).matrixTransform(matrix);
        near(actual.x, p.x, 'hollow-use geometry x'); near(actual.y, p.y, 'hollow-use geometry y');
      });
      check(marker(doc.querySelector('#b')) === original && original.outerHTML === originalMarkup && source.outerHTML === sourceMarkup, 'hollow-use recoloring mutated shared source definitions');
    }
    results.push('unflattened use markers retain inline/class hollow paint and geometry on recolor without changing shared definitions');

    loadSVGText(visio, 'group-arrows.svg'); select([doc.querySelector('#wires')]);
    check(currentArrowState().els.length === 2 && currentArrowState().end, 'group selection does not expose its arrow lines');
    toggleArrow('end');
    check(['a','b'].every(id => getComputedStyle(doc.querySelector('#' + id)).markerEnd === 'none'), 'group arrow controls did not edit its child lines');
    results.push('group arrow controls act on the same child lines shown by the line panel');

    const shapes = [];
    for (const style of ['triangle', 'open', 'stealth']) {
      loadSVGText(svg('<line id="native" x1="50" y1="100" x2="180" y2="100" stroke="#234567" stroke-width="2"/>'), 'native-arrows.svg');
      line = use('native'); setArrowStyle(style);
      if (!currentArrowState().end) toggleArrow('end');
      shapes.push(glyph(marker(line)));
      check($('inpArrowStyle').value === style, 'style selector did not read back ' + style);
      const before = snapshot(), undoDepth = state.undo.length;
      const prepared = AIEditCore.prepareSVG(buildSVGString());
      check(prepared.querySelector('marker path'), 'AI static preparation lost ' + style + ' arrow geometry');
      const captured = new DOMParser().parseFromString(libraryCaptureSelection(), 'image/svg+xml');
      check(!captured.querySelector('parsererror') && captured.querySelector('marker path'), 'custom-library capture failed for ' + style);
      check(snapshot() === before && state.undo.length === undoDepth, 'static preparation/capture changed the canvas or history');
    }
    check(new Set(shapes).size === 3, 'arrow presets are not distinct shapes');
    const styleDepth = state.undo.length;
    setArrowStyle('open');
    check(state.undo.length === styleDepth + 1 && $('inpArrowStyle').value === 'open', 'style change should be one undoable operation');
    undo(); line = use('native'); check($('inpArrowStyle').value === 'stealth', 'style undo did not restore the prior arrow');
    redo(); line = use('native'); check($('inpArrowStyle').value === 'open', 'style redo did not restore the new arrow');
    results.push('three distinct arrow presets retain editable geometry through static AI preparation and custom-library capture');

    setArrowStyle('triangle'); if (!currentArrowState().start) toggleArrow('start');
    setArrowPos('tip'); setArrowOffset(0);
    const tipOffset = side => {
      const mk = marker(line, side), vb = mk.viewBox.baseVal;
      const reverse = side === 'start' && mk.getAttribute('orient') === 'auto-start-reverse';
      const tip = side === 'start' && !reverse ? vb.x : vb.x + vb.width;
      return (tip - mk.refX.baseVal.value) * mk.markerWidth.baseVal.value / vb.width * 2 * (reverse ? -1 : 1);
    };
    const baseline = [tipOffset('start'), tipOffset('end')];
    setArrowOffset(1);
    near(tipOffset('start') - baseline[0], 2, 'positive start offset must move inward');
    near(tipOffset('end') - baseline[1], -2, 'positive end offset must move inward');
    setArrowOffset(-1);
    near(tipOffset('start') - baseline[0], -2, 'negative start offset must move outward');
    near(tipOffset('end') - baseline[1], 2, 'negative end offset must move outward');
    results.push('positive and negative offsets move start/end arrow tips inward and outward consistently');

    for (const attr of ['data-size="NaN"', 'data-pos="bad"', 'data-off="Infinity"', 'data-arbitrary="allowed?"']) {
      let rejected = false;
      try { AIEditCore.prepareSVG(svg('<defs><marker id="bad" ' + attr + '><path d="M0 0L10 5L0 10Z"/></marker></defs><line x2="20" marker-end="url(#bad)"/>')); }
      catch (error) { rejected = true; }
      check(rejected, 'unsafe or unknown marker metadata was accepted: ' + attr);
    }
    results.push('marker metadata allowance stays exact and rejects invalid numeric/enum and arbitrary data attributes');

    setUILanguage('en', false);
    const english = $('inpArrowStyle').textContent;
    check(!/[\u4e00-\u9fff]/.test(english), 'arrow style choices were not translated');
    setUILanguage('zh-CN', false);
    check(/[\u4e00-\u9fff]/.test($('inpArrowStyle').textContent), 'arrow style choices did not switch back to Chinese');
    check(window.__auditErrors.length === 0, 'browser errors: ' + window.__auditErrors.join('; '));
    results.push('new arrow choices switch between English and Chinese without changing the drawing');
    return results;
  }.toString() + ')()');

  // Marker pixels are not a native SVG pointer target. Exercise real pointer selection,
  // including a marquee that only touches the head and does not touch the line itself.
  await evalJS('(' + function () {
    loadSVGText('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><defs><marker id="pick-tip" markerUnits="userSpaceOnUse" markerWidth="20" markerHeight="20" viewBox="0 -10 20 20" refX="0" refY="0" orient="auto" overflow="visible"><path d="M0 -10L20 0L0 10Z" fill="#111"/></marker></defs><path id="pick-line" d="M40 100H140" fill="none" stroke="#111" stroke-width="2" marker-end="url(#pick-tip)"/></svg>', 'pick-arrows.svg');
    state.zoom = 1; centerDoc(); applyZoom(); clearSelection();
    return true;
  }.toString() + ')()');
  const point = async (x, y) => evalJS(`(() => { const p = new DOMPoint(${x},${y}).matrixTransform(doc.getScreenCTM()); return {x:p.x,y:p.y}; })()`);
  const mouse = async (type, p, buttons) => send('Input.dispatchMouseEvent', { type, button:type === 'mouseMoved' ? 'none' : 'left', buttons, clickCount:1, ...p });
  let p = await point(151, 102);
  await mouse('mousePressed', p, 1); await mouse('mouseReleased', p, 0);
  assert.deepEqual(await evalJS('[...state.sel].map(el => el.id)'), ['pick-line'], 'clicking the head should select its line');
  await evalJS('clearSelection(); true;');
  await mouse('mousePressed', await point(170, 84), 1);
  await mouse('mouseMoved', await point(147, 115), 1);
  await mouse('mouseReleased', await point(147, 115), 0);
  assert.deepEqual(await evalJS('[...state.sel].map(el => el.id)'), ['pick-line'], 'marquee touching only the head should select its line');
  await evalJS('(' + function () {
    loadSVGText('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><defs><marker id="pick-tip" markerUnits="userSpaceOnUse" markerWidth="20" markerHeight="20" viewBox="0 -10 20 20" refX="0" refY="0" orient="auto-start-reverse" overflow="visible"><path d="M0 -10L20 0L0 10Z" fill="#111"/></marker></defs><g transform="translate(100 30) rotate(25) scale(1.2)"><path id="pick-line" d="M40 100H140" fill="none" stroke="#111" stroke-width="2" marker-start="url(#pick-tip)" marker-end="url(#pick-tip)"/></g></svg>', 'transformed-arrows.svg');
    flattenSelection(false, false); state.zoom = .8; centerDoc(); applyZoom(); clearSelection();
    window.__arrowPickBefore = snapshot(); window.__arrowPickUndo = state.undo.length;
    return true;
  }.toString() + ')()');
  const linePoint = async (x, y) => evalJS(`(() => { const p = new DOMPoint(${x},${y}).matrixTransform(doc.querySelector('#pick-line').getScreenCTM()); return {x:p.x,y:p.y}; })()`);
  const lineGeometry = () => evalJS(`(() => { const el = doc.querySelector('#pick-line'); return { d:el.getAttribute('d'), transform:el.getAttribute('transform') }; })()`);
  for (const x of [151, 29]) {
    await evalJS('clearSelection(); true;');
    p = await linePoint(x, 102);
    await mouse('mousePressed', p, 1); await mouse('mouseReleased', p, 0);
    assert.deepEqual(await evalJS('[...state.sel].map(el => el.id)'), ['pick-line'], 'transformed end/start head should select its line');
  }
  assert.equal(await evalJS('snapshot() === window.__arrowPickBefore'), true, 'head selection must not add proxies or change source SVG');
  await evalJS('clearSelection(); true;');
  const beforeDrag = await lineGeometry();
  p = await linePoint(151, 102);
  await mouse('mousePressed', p, 1);
  await mouse('mouseMoved', {x:p.x + 17, y:p.y - 9}, 1);
  await mouse('mouseReleased', {x:p.x + 17, y:p.y - 9}, 0);
  const afterDrag = await lineGeometry();
  assert.notDeepEqual(afterDrag, beforeDrag, 'dragging the head should change the whole line geometry');
  assert.equal(await evalJS('state.undo.length - window.__arrowPickUndo'), 1, 'head drag should be one undo step');
  await evalJS('undo(); true;');
  const restored = await lineGeometry();
  assert.deepEqual(restored, beforeDrag, 'head drag undo should exactly restore line geometry attributes');
  await evalJS('(' + function () {
    loadSVGText('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><defs><marker id="pick-tip" markerUnits="userSpaceOnUse" markerWidth="20" markerHeight="20" viewBox="0 -10 20 20" refX="0" refY="0" orient="auto-start-reverse" overflow="visible"><path d="M0 -10L20 0L0 10Z" fill="#111"/></marker></defs><path id="pick-line" d="M20 40H60 M100 80H160" fill="none" stroke="#111" stroke-width="2" marker-start="url(#pick-tip)" marker-end="url(#pick-tip)"/></svg>', 'subpath-arrows.svg');
    state.zoom = 1; centerDoc(); applyZoom(); clearSelection(); return true;
  }.toString() + ')()');
  for (const [x, y] of [[70,42], [90,82]]) {
    p = await point(x, y);
    await mouse('mousePressed', p, 1); await mouse('mouseReleased', p, 0);
    assert.equal(await evalJS('state.sel.size'), 0, 'inner subpath endpoints must not produce ghost arrow hit areas');
  }
  for (const order of ['background', 'foreground']) {
    await evalJS('(' + function (order) {
      const rect = '<rect id="pick-rect" x="140" y="90" width="20" height="20" fill="#ccc"/>';
      loadSVGText('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><defs><marker id="pick-tip" markerUnits="userSpaceOnUse" markerWidth="20" markerHeight="20" viewBox="0 -10 20 20" refX="0" refY="0" orient="auto" overflow="visible"><path d="M0 -10L20 0L0 10Z" fill="#111"/></marker></defs>' +
        (order === 'background' ? rect : '') + '<path id="pick-line" d="M40 100H140" fill="none" stroke="#111" stroke-width="2" marker-end="url(#pick-tip)"/>' +
        (order === 'foreground' ? rect : '') + '</svg>', 'paint-order-arrows.svg');
      state.zoom = 1; centerDoc(); applyZoom(); clearSelection(); return true;
    }.toString() + ')(' + JSON.stringify(order) + ')');
    p = await point(151, 102);
    await mouse('mousePressed', p, 1); await mouse('mouseReleased', p, 0);
    assert.deepEqual(await evalJS('[...state.sel].map(el => el.id)'), [order === 'background' ? 'pick-line' : 'pick-rect'], order + ' paint order should determine head selection');
  }
  assert.deepEqual(await evalJS('window.__auditErrors'), []);
  result.push('real head-only clicking and marquee select the owning line without splitting or adding SVG objects');
  result.push('transformed start-reverse/end heads stay selectable at non-default zoom, drag the whole line and undo once');
  result.push('compound paths do not invent selectable start/end arrows at inner subpath endpoints');
  result.push('head picking beats an earlier background rectangle but respects a later foreground rectangle');
  console.log('PASS: arrow compatibility (' + result.length + ' scenarios)');
  result.forEach(message => console.log('  ' + message));
}).catch(error => { console.error(error); process.exitCode = 1; });
