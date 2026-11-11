// Run: node tests/io.cjs
const assert = require('node:assert/strict');
const { withEditor } = require('./browser.cjs');

withEditor(async ({ evalJS }) => {
  const result = await evalJS(`(async () => {
    const writes = [], demoWrites = [];
    let pickCalls = 0;
    const handle = {
      name:'original.svg', kind:'file',
      queryPermission:async () => 'granted', requestPermission:async () => 'granted',
      createWritable:async () => ({ write:async b => writes.push(await b.text()), close:async () => {} })
    };
    const demoHandle = {
      ...handle, name:'demo-copy.svg',
      createWritable:async () => ({ write:async b => demoWrites.push(await b.text()), close:async () => {} })
    };
    const simple = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect id="r" width="10" height="10"/></svg>';
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable:true, writable:true, value:async () => { pickCalls++; return handle; }
    });
    loadSVGText(simple, 'a.svg');
    await saveAs();
    const firstSaveReleased = !state.saving;
    doc.querySelector('#r').setAttribute('width','20'); markDirty();
    await save(); await saveAs();
    const repeatedSave = { firstSaveReleased, saving:state.saving, writes:writes.length, pickCalls, dirty:state.dirty };

    markDirty();
    window.showSaveFilePicker = async () => { throw new DOMException('cancelled', 'AbortError'); };
    await saveAs();
    const cancelledSave = { saving:state.saving, dirty:state.dirty, sameHandle:state.fileHandle === handle, writes:writes.length };
    await save();
    const saveAfterCancel = { saving:state.saving, writes:writes.length };

    loadSVGText(simple, 'original.svg', handle);
    const previousMarkup = doc.innerHTML;
    markDirty();
    const failedResult = loadSVGText('<svg>', 'broken.svg', demoHandle);
    const failedLoad = { result:failedResult, sameHandle:state.fileHandle === handle, fileName:state.fileName, sameMarkup:doc.innerHTML === previousMarkup, dirty:state.dirty };

    $('btnDemo').onclick();
    const demoUnbound = state.fileHandle === null;
    window.showSaveFilePicker = async () => { pickCalls++; return demoHandle; };
    await save();
    const demoSave = { unbound:demoUnbound, originalWrites:writes.length, demoWrites:demoWrites.length, containsDemo:demoWrites[0].includes('输出') };

    loadSVGText(simple, 'original.svg', handle);
    readFile(new File([simple], 'traditional.svg', { type:'image/svg+xml' }));
    await new Promise(resolve => setTimeout(resolve, 80));
    const traditionalLoad = { fileName:state.fileName, unbound:state.fileHandle === null };

    const styled = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="fill:rgb(255,0,0);font-family:Times New Roman;stroke:#123456;stroke-width:2"><rect id="r" width="10" height="10"/><text x="10" y="20">text</text></svg>';
    loadSVGText(styled, 'styled.svg');
    const appearance = svg => ({ fill:getComputedStyle(svg.querySelector('rect')).fill, font:getComputedStyle(svg.querySelector('text')).fontFamily, stroke:getComputedStyle(svg.querySelector('rect')).stroke });
    const before = appearance(doc);
    const exported = new DOMParser().parseFromString(buildSVGString(), 'image/svg+xml').documentElement;
    const noLayoutStyles = ['width','height','left','top','box-shadow'].every(prop => !exported.style.getPropertyValue(prop));
    exported.id = 'roundtrip';
    const display = document.importNode(exported, true); document.body.appendChild(display);
    const afterExport = appearance(display); display.remove();
    pushUndo(); doc.querySelector('rect').setAttribute('x','20'); undo();
    const afterUndo = appearance(doc);
    loadSVGText(simple, 'simple.svg');
    const emptyStyleRemoved = new DOMParser().parseFromString(buildSVGString(), 'image/svg+xml').documentElement.getAttribute('style') === null;

    const visio = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' +
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:v="http://schemas.microsoft.com/visio/2003/SVGExtensions/" width="4in" height="3in" viewBox="10 20 400 300">' +
      '<v:documentProperties v:langID="1033"/><style><![CDATA[.visio-shape{fill:rgb(35,91,137);stroke:rgb(12,34,56);stroke-width:2px}]]></style>' +
      '<g v:mID="1" transform="translate(8 12)"><rect id="visio-rect" class="visio-shape" x="5" y="6" width="70" height="40"/>' +
      '<text id="visio-label" x="5" y="60"><![CDATA[A < B & C]]></text></g></svg>';
    const inspectVisio = () => {
      const rect = doc.querySelector('#visio-rect'), text = doc.querySelector('#visio-label'), css = getComputedStyle(rect);
      return { viewBox:doc.getAttribute('viewBox'), dimensions:[state.docW,state.docH],
        geometry:['x','y','width','height'].map(name => rect.getAttribute(name)), transform:rect.parentNode.getAttribute('transform'),
        text:text.textContent, fill:css.fill, stroke:css.stroke, strokeWidth:css.strokeWidth,
        shapes:doc.querySelectorAll('rect,text').length, metadataRemoved:!doc.querySelector('documentProperties') && !rect.parentNode.hasAttributeNS('http://schemas.microsoft.com/visio/2003/SVGExtensions/', 'mID') };
    };
    const visioLoaded = loadSVGText(visio, 'synthetic-visio.svg'), visioBefore = inspectVisio();
    const visioExport = buildSVGString();
    pushUndo(); doc.querySelector('#visio-rect').setAttribute('width', '99'); markDirty(); undo();
    const visioAfterUndo = inspectVisio();
    const visioReloaded = loadSVGText(visioExport, 'visio-roundtrip.svg'), visioAfterReload = inspectVisio();
    const payload = parseSvgPayload(visio), payloadStyle = payload.find(node => node.localName === 'style'), payloadGroup = payload.find(node => node.localName === 'g');
    const fragment = parseSvgPayload('<text xmlns="http://www.w3.org/2000/svg"><![CDATA[X < Y & Z]]></text>');
    const visioPayload = { elements:payload.map(node => node.localName), css:payloadStyle.textContent,
      text:payloadGroup.querySelector('text').textContent, geometry:payloadGroup.querySelector('rect').getAttribute('width'),
      textNodes:payloadStyle.firstChild.nodeType === 3 && payloadGroup.querySelector('text').firstChild.nodeType === 3,
      fragment:fragment[0].textContent, fragmentTextNode:fragment[0].firstChild.nodeType === 3 };
    return { repeatedSave, cancelledSave, saveAfterCancel, failedLoad, demoSave, traditionalLoad, rootStyles:{ before, afterExport, afterUndo, noLayoutStyles, emptyStyleRemoved },
      cdata:{ loaded:visioLoaded, before:visioBefore, afterUndo:visioAfterUndo, reloaded:visioReloaded, afterReload:visioAfterReload, payload:visioPayload }, errors:window.__auditErrors };
  })()`);
  assert.deepEqual(result.repeatedSave, { firstSaveReleased:true, saving:false, writes:3, pickCalls:2, dirty:false });
  assert.deepEqual(result.cancelledSave, { saving:false, dirty:true, sameHandle:true, writes:3 });
  assert.deepEqual(result.saveAfterCancel, { saving:false, writes:4 });
  assert.deepEqual(result.failedLoad, { result:false, sameHandle:true, fileName:'original.svg', sameMarkup:true, dirty:true });
  assert.deepEqual(result.demoSave, { unbound:true, originalWrites:4, demoWrites:1, containsDemo:true });
  assert.deepEqual(result.traditionalLoad, { fileName:'traditional.svg', unbound:true });
  assert.deepEqual(result.rootStyles.afterExport, result.rootStyles.before);
  assert.deepEqual(result.rootStyles.afterUndo, result.rootStyles.before);
  assert.equal(result.rootStyles.noLayoutStyles, true);
  assert.equal(result.rootStyles.emptyStyleRemoved, true);
  assert.equal(result.cdata.loaded, true);
  assert.deepEqual(result.cdata.before, { viewBox:'10 20 400 300', dimensions:[400,300], geometry:['5','6','70','40'], transform:'translate(8 12)',
    text:'A < B & C', fill:'rgb(35, 91, 137)', stroke:'rgb(12, 34, 56)', strokeWidth:'2px', shapes:2, metadataRemoved:true });
  assert.deepEqual(result.cdata.afterUndo, result.cdata.before);
  assert.equal(result.cdata.reloaded, true);
  assert.deepEqual(result.cdata.afterReload, result.cdata.before);
  assert.deepEqual(result.cdata.payload, { elements:['style','g'], css:'.visio-shape{fill:rgb(35,91,137);stroke:rgb(12,34,56);stroke-width:2px}',
    text:'A < B & C', geometry:'70', textNodes:true, fragment:'X < Y & Z', fragmentTextNode:true });
  assert.deepEqual(result.errors, []);
  console.log('I/O fixes regression PASS');
  console.log(JSON.stringify(result, null, 2));
}).then(testOpenPickers).catch(error => { console.error(error); process.exitCode = 1; });

async function testOpenPickers() {
  await withEditor(async ({ evalJS }) => {
    const result = await evalJS(`(async () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="10" height="10"/></svg>';
      let inputClicks = 0;
      HTMLInputElement.prototype.click = function () { if (this.type === 'file') inputClicks++; };
      const handle = { name:'native.svg', kind:'file', getFile:async () => new File([svg], 'native.svg') };
      Object.defineProperty(window, 'showOpenFilePicker', { configurable:true, writable:true, value:async () => [handle] });
      await $('btnOpen').onclick();
      const loaded = state.fileName === 'native.svg' && state.fileHandle === handle && lastOpenHandle === handle;
      pushUndo(); doc.querySelector('rect').setAttribute('x', '5'); markDirty();
      const snapshot = () => JSON.stringify([doc.innerHTML, state.fileName, state.dirty, state.undo, state.redo]);
      const before = snapshot();
      window.showOpenFilePicker = async () => { throw new DOMException('cancelled', 'AbortError'); };
      await $('btnOpen').onclick();
      const cancelled = snapshot() === before && state.fileHandle === handle;
      const failures = [];
      for (const stage of ['getFile', 'text']) {
        window.showOpenFilePicker = async () => [{ ...handle, getFile:async () => {
          if (stage === 'getFile') throw new Error('getFile failed');
          return { name:'broken.svg', text:async () => { throw new Error('text failed'); } };
        } }];
        await $('btnOpen').onclick();
        failures.push(snapshot() === before && state.fileHandle === handle && $('toast').textContent.includes(stage + ' failed'));
      }
      return { loaded, cancelled, failures, inputClicks, errors:window.__auditErrors };
    })()`);
    assert.deepEqual(result, { loaded:true, cancelled:true, failures:[true, true], inputClicks:0, errors:[] });
  });

  for (const mode of ['unsupported', 'active', 'consumed']) {
    const choosers = [];
    await withEditor(async ({ evalJS, send, delay }) => {
      await send('Page.setInterceptFileChooserDialog', { enabled:true });
      await evalJS(`window.__pickerCalls = 0;
        Object.defineProperty(window, 'showOpenFilePicker', { configurable:true, writable:true, value:${mode === 'unsupported' ? 'undefined' : `async () => {
          window.__pickerCalls++;
          ${mode === 'consumed' ? "const child = window.open('about:blank'); if (child) child.close();" : ''}
          throw new DOMException('browser policy failure', 'SecurityError');
        }`} }); true;`);
      const clickOpen = async () => {
        const { x, y } = await evalJS(`(() => { const r = $('btnOpen').getBoundingClientRect(); return {x:r.x + r.width / 2, y:r.y + r.height / 2}; })()`);
        await send('Input.dispatchMouseEvent', { type:'mousePressed', button:'left', clickCount:1, x, y });
        await send('Input.dispatchMouseEvent', { type:'mouseReleased', button:'left', clickCount:1, x, y });
        await delay(100);
      };
      await clickOpen();
      assert.equal(choosers.length, mode === 'consumed' ? 0 : 1, mode + ' initial chooser');
      if (mode === 'consumed') assert.match(await evalJS(`$('toast').textContent`), /再点/);
      await clickOpen();
      assert.equal(choosers.length, mode === 'consumed' ? 1 : 2, mode + ' retry chooser');
      assert.equal(await evalJS('window.__pickerCalls'), mode === 'unsupported' ? 0 : 1, mode + ' native retries');
      const result = await evalJS(`(async () => {
        const input = document.querySelector('input[type="file"][accept*=".svg"]');
        const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'], 'repeat.svg', {type:'image/svg+xml'});
        const resets = [];
        for (let i = 0; i < 2; i++) {
          const transfer = new DataTransfer(); transfer.items.add(file);
          input.files = transfer.files; input.dispatchEvent(new Event('change'));
          resets.push(input.value === '');
          await new Promise(resolve => setTimeout(resolve, 80));
          if (state.fileName !== 'repeat.svg' || state.fileHandle !== null || doc.querySelector('rect').getAttribute('width') !== '10') throw new Error('File input did not load SVG');
          doc.querySelector('rect').setAttribute('width', '20');
        }
        const before = doc.innerHTML, Reader = window.FileReader;
        window.FileReader = class { readAsText() { this.error = new Error('file read denied'); this.onerror(); } };
        readFile(file); window.FileReader = Reader;
        const readFailure = doc.innerHTML === before && $('toast').textContent.includes('file read denied');
        return { connected:input.isConnected, resets, readFailure, errors:window.__auditErrors };
      })()`);
      assert.deepEqual(result, { connected:true, resets:[true, true], readFailure:true, errors:[] });
    }, { onEvent:msg => { if (msg.method === 'Page.fileChooserOpened') choosers.push(msg.params); } });
  }
  console.log('Open picker compatibility regression PASS');
}
