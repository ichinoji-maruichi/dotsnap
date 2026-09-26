const {chromium}=require(process.env.DOTSNAP_PLAYWRIGHT||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:"msedge"});const page=await browser.newPage({viewport:{width:1400,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(process.env.DOTSNAP_URL||'http://127.0.0.1:4173');await page.click('#sample');await page.waitForFunction(()=>document.querySelector('#frames').children.length===8);
 await page.check('#dotGrid');
 for(const zoom of ['1','2','4','8','12']){await page.selectOption('#zoom',zoom);const g=page.locator('#afterViewport .preview-grid[data-kind="dots"]');assert.equal(await g.isVisible(),true);assert.equal(await g.evaluate(e=>getComputedStyle(e).backgroundSize.split(',')[0]),zoom+'px '+zoom+'px');const aligned=await g.evaluate(e=>{const a=e.getBoundingClientRect(),b=e.parentElement.querySelector('canvas').getBoundingClientRect();return Math.abs(a.x-b.x)<1&&Math.abs(a.y-b.y)<1&&a.width===b.width&&a.height===b.height;});assert.ok(aligned);}
 await page.check('#grid');
 for(const zoom of ['2','4','12']){await page.selectOption('#zoom',zoom);const g=page.locator('#afterViewport .preview-grid[data-kind="frames"]');assert.equal(await g.isVisible(),true);assert.equal(await g.evaluate(e=>getComputedStyle(e).backgroundSize.split(',')[0]),(+zoom*32)+'px '+(+zoom*32)+'px');assert.equal(await page.locator('#afterViewport .preview-grid[data-kind="dots"]').isVisible(),true);}
 await page.uncheck('#dotGrid');assert.equal(await page.locator('#afterViewport .preview-grid[data-kind="frames"]').isVisible(),true);assert.equal(await page.locator('#afterViewport .preview-grid[data-kind="dots"]').isVisible(),false);await page.check('#dotGrid');await page.uncheck('#grid');
 await page.click('[data-view="compare"]');assert.equal(await page.locator('#beforeViewport .preview-grid[data-kind="dots"]').isVisible(),true);await page.click('[data-view="source"]');assert.equal(await page.locator('#afterViewport .preview-grid[data-kind="dots"]').isVisible(),false);await page.click('[data-view="result"]');
 await page.click('#manualMode');await page.waitForSelector('body.editing');await page.click('#maximize');
 await page.locator('#editPalette button').first().click();const c=page.locator('#mainCanvas');const box=await c.boundingBox();
 await page.mouse.move(box.x+6,box.y+6);await page.mouse.down();await page.mouse.move(box.x+66,box.y+6,{steps:5});await page.mouse.up();
 async function pixel(x,y){return c.evaluate((el,{x,y})=>Array.from(el.getContext('2d').getImageData(x,y,1,1).data),{x,y});}
 const drawn=await pixel(0,0);assert.equal(drawn[3],255);
 await page.locator('input[name="editTool"][value="pen"]').focus();await page.keyboard.press('Control+z');assert.equal((await pixel(0,0))[3],0);await page.keyboard.press('Control+y');assert.deepEqual(await pixel(0,0),drawn);
 await c.hover();assert.match(await page.locator('#toolCursor').textContent(),/ペン/);await page.keyboard.down('Shift');assert.match(await page.locator('#toolCursor').textContent(),/消しゴム/);await page.keyboard.up('Shift');await page.keyboard.down('Alt');assert.match(await page.locator('#toolCursor').textContent(),/スポイト/);await page.keyboard.up('Alt');assert.match(await page.locator('#toolCursor').textContent(),/ペン/);
 await page.keyboard.press('=');assert.equal(await page.locator('#zoom').inputValue(),'16');await page.keyboard.press('-');assert.equal(await page.locator('#zoom').inputValue(),'12');
 await c.hover();await page.keyboard.down('Control');await page.mouse.wheel(0,-100);await page.keyboard.up('Control');assert.equal(await page.locator('#zoom').inputValue(),'16');await page.keyboard.press('-');
 await page.selectOption('#zoom','64');assert.equal(await c.evaluate(e=>e.width),32);assert.equal(await c.evaluate(e=>e.style.width),'2048px');await page.selectOption('#zoom','12');

 await page.click('#undo');assert.equal((await pixel(0,0))[3],0);await page.click('#redo');assert.deepEqual(await pixel(0,0),drawn);
 await page.keyboard.press('ArrowRight');assert.equal((await pixel(0,0))[3],0);assert.deepEqual(await pixel(1,0),drawn);
 await page.check('input[name="editTool"][value="erase"]');await c.click({position:{x:18,y:6}});assert.equal((await pixel(1,0))[3],0);await page.click('#undo');assert.deepEqual(await pixel(1,0),drawn);
 await page.check('input[name="editTool"][value="pen"]');await c.click({position:{x:18,y:6},modifiers:['Shift']});assert.equal((await pixel(1,0))[3],0);assert.equal(await page.locator('input[name="editTool"][value="pen"]').isChecked(),true);await page.click('#undo');
 await page.locator('#editPalette button').last().click();const beforePick=await c.evaluate(e=>e.toDataURL());await c.click({position:{x:18,y:6},modifiers:['Alt']});assert.equal(await c.evaluate(e=>e.toDataURL()),beforePick);assert.equal(await page.locator('#editColor').textContent(),'#'+drawn.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join(''));assert.equal(await page.locator('input[name="editTool"][value="pen"]').isChecked(),true);
 assert.equal(await page.locator('#afterViewport .preview-grid[data-kind="dots"]').isVisible(),true);await page.uncheck('#editGrid');assert.equal(await page.locator('#afterViewport .preview-grid[data-kind="dots"]').isVisible(),false);await page.check('#editGrid');
 assert.equal(await page.locator('#grid').isVisible(),false);assert.equal(await page.locator('#changes').isVisible(),false);assert.equal(await page.locator('#conversionControls').isVisible(),false);assert.equal(await page.locator('.controls #editTools').isVisible(),true);assert.equal(await page.locator('.controls #saveProject').isEnabled(),true);
 await page.click('[data-view="compare"]');assert.equal(await page.locator('#beforeCanvas').isVisible(),true);await page.click('[data-view="result"]');
 await page.keyboard.press('Escape');const downloadPromise=page.waitForEvent('download');await page.click('#saveProject');const download=await downloadPromise;await download.saveAs('tests/manual-roundtrip.dotsnap');
 const pngPromise=page.waitForEvent('download');await page.click('#exportFrame');await (await pngPromise).saveAs('tests/manual-frame.png');
 await page.click('#manualMode');await page.waitForFunction(()=>!document.body.classList.contains('editing'));
 await page.setInputFiles('#projectFile','tests/manual-roundtrip.dotsnap');await page.waitForSelector('body.editing');assert.deepEqual(await pixel(1,0),drawn);
 const handle=await page.locator('#previewResize').boundingBox();const oldHeight=await page.locator('#stage').evaluate(e=>e.clientHeight);await page.mouse.move(handle.x+50,handle.y+10);await page.mouse.down();await page.mouse.move(handle.x+50,handle.y+90);await page.mouse.up();assert.ok(await page.locator('#stage').evaluate(e=>e.clientHeight)>oldHeight);
 await page.screenshot({path:'tests/manual-screen.png',fullPage:true});
 await page.click('#manualMode');await page.click('#addKey');await page.click('#mainCanvas',{position:{x:3,y:3}});await page.waitForFunction(()=>document.querySelector('#extraKeys').children.length===1);
 await page.waitForFunction(()=>!document.querySelector('#status').classList.contains('busy'));assert.equal(await page.locator('[data-p="tolerance"]').getAttribute('max'),'442');
 const fs=require('node:fs'),{decode,inspect}=require('./verify-png.cjs');const output=decode(fs.readFileSync('tests/manual-frame.png'));assert.deepEqual(Array.from(output.data.slice(4,8)),drawn);assert.equal(inspect(fs.readFileSync('tests/manual-frame.png')).width,32);
 await page.setViewportSize({width:390,height:844});await page.click('#manualMode');await page.click('#maximize');assert.ok(await page.locator('#stage').evaluate(e=>e.clientHeight)>=100);await page.screenshot({path:'tests/manual-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Browser: paint, stroke undo/redo, move, compare, save/reopen, PNG, extra key: PASS');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});



