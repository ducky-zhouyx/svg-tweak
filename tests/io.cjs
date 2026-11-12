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
}).then(testOpenPickers).then(testDroppedFileSave).then(testSaveFailures).catch(error => { console.error(error); process.exitCode = 1; });

async function testDroppedFileSave() {
  await withEditor(async ({evalJS}) => {
    const result = await evalJS('(' + (async () => {
      const source='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect id="dropped-rect" width="10" height="10"/></svg>';
      const writes=[];
      let picks=0,requests=0,permission='prompt';
      const handle={name:'existing.svg',kind:'file',queryPermission:async () => permission,
        requestPermission:async () => {requests++;return permission='granted';},
        createWritable:async () => ({write:async blob => {writes.push(await blob.text());},close:async () => {}})};
      window.showSaveFilePicker=async () => {picks++;throw new DOMException('overwrite picker aborted','AbortError');};
      const drop=async (contents,getHandle,name='existing.svg') => {
        const file=new File([contents],name,{type:'image/svg+xml'}),event=new Event('drop',{cancelable:true});
        Object.defineProperty(event,'dataTransfer',{value:{files:[file],items:[{getAsFileSystemHandle:getHandle}]}});
        window.dispatchEvent(event);
        for(let i=0;i<100;i++) {
          if(state.fileName===name) return;
          await new Promise(resolve=>setTimeout(resolve,10));
        }
        throw new Error('Dropped file did not load');
      };
      await drop(source,async () => handle);
      const bound=state.fileHandle===handle;
      for(const width of ['20','30']) {
        doc.querySelector('#dropped-rect').setAttribute('width',width);markDirty();
        await $('btnSave').onclick();
      }
      const saved={bound,picks,requests,count:writes.length,widths:writes.map(xml=>
        new DOMParser().parseFromString(xml,'image/svg+xml').querySelector('#dropped-rect').getAttribute('width')),
        dirty:state.dirty,saving:state.saving,handle:state.fileHandle===handle,remembered:lastOpenHandle===handle};
      await drop(source,async () => {throw new Error('File handles unavailable');},'fallback.svg');
      return {saved,fallback:{name:state.fileName,unbound:state.fileHandle===null},errors:__auditErrors};
    }).toString() + ')()');
    assert.deepEqual(result.saved,{bound:true,picks:0,requests:1,count:2,widths:['20','30'],dirty:false,saving:false,handle:true,remembered:true},
      'Dragging an existing SVG must retain its native file handle and Save must write through it instead of opening an overwrite picker');
    assert.deepEqual(result.fallback,{name:'fallback.svg',unbound:true});assert.deepEqual(result.errors,[]);
  });
  console.log('Dropped SVG save regression PASS: drag retains the original file handle, requests write permission once and repeated Save writes edits without invoking the overwrite picker; unavailable handles do not retain a previous file association.');
}

async function testSaveFailures() {
  await withEditor(async ({evalJS}) => {
    const result = await evalJS('(' + (async () => {
      const simple = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="10" height="10"/></svg>';
      const cases = [];
      let downloads = 0, pickerCalls = 0;
      const click = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { downloads++; };
      try {
        for (const method of ['save','saveAs']) {
          for (const stage of ['create','write','close']) {
            for (const name of ['AbortError','NotAllowedError']) {
              let aborts = 0;
              const fail = () => { throw new DOMException('mock ' + stage + ' failed', name); };
              const handle = {name:'original.svg',kind:'file',queryPermission:async () => 'granted',
                createWritable:async () => {
                  if (stage === 'create') fail();
                  return {write:async () => { if (stage === 'write') fail(); },
                    close:async () => { if (stage === 'close') fail(); }, abort:async () => { aborts++; }};
                }};
              const candidate = {...handle,name:'copy.svg'};
              loadSVGText(simple,'original.svg',handle);markDirty();lastOpenHandle=handle;
              window.showSaveFilePicker=async () => { pickerCalls++;return candidate; };
              await (method === 'save' ? save() : saveAs());
              cases.push({method,stage,name,dirty:state.dirty,saving:state.saving,sameHandle:state.fileHandle===handle,
                rememberedOriginal:lastOpenHandle===handle,message:$('toast').textContent,progress:$('progLabel').textContent,aborts});
            }
          }
        }
        window.showSaveFilePicker=async () => { throw new DOMException('mock picker aborted','AbortError'); };
        await saveAs();
        const canceled={dirty:state.dirty,saving:state.saving,message:$('toast').textContent};
        let written='';
        window.showSaveFilePicker=async () => ({name:'retry.svg',kind:'file',createWritable:async () => ({
          write:async blob => {written=await blob.text();},close:async () => {}
        })});
        await saveAs();
        const retry=!!written&&state.fileName==='retry.svg'&&!state.dirty&&!state.saving;
        markDirty();
        Object.defineProperty(window,'showSaveFilePicker',{configurable:true,writable:true,value:undefined});
        await saveAs();
        const unsupported={dirty:state.dirty,saving:state.saving,message:$('toast').textContent};
        return {cases,canceled,retry,unsupported,downloads,pickerCalls,errors:__auditErrors};
      } finally { HTMLAnchorElement.prototype.click=click; }
    }).toString() + ')()');
    const stages={create:'创建文件',write:'写入文件',close:'完成写入'};
    for (const item of result.cases) {
      assert.ok(item.dirty&&!item.saving&&item.sameHandle&&item.rememberedOriginal,JSON.stringify(item));
      assert.match(item.message,/保存失败/);assert.ok(item.message.includes(stages[item.stage]));
      assert.ok(item.message.includes(item.name));
      assert.equal(item.progress,'保存失败');assert.equal(item.aborts,item.stage==='create'?0:1);
    }
    assert.ok(result.canceled.dirty&&!result.canceled.saving);assert.match(result.canceled.message,/保存窗口.*中止/);
    assert.ok(result.unsupported.dirty&&!result.unsupported.saving);assert.match(result.unsupported.message,/不支持文件保存/);
    assert.equal(result.retry,true);assert.equal(result.downloads,0);assert.equal(result.pickerCalls,6);assert.deepEqual(result.errors,[]);
  });
  console.log('Save failures regression PASS: create/write/close AbortError and permission errors stay unsaved, release streams, identify the failing step and allow retry; picker cancellation does not download.');
}

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
