const {chromium}=require(process.env.DOTSNAP_PLAYWRIGHT||'playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const file of ['dotsnap.html','index.html']){
   const page=await browser.newPage({viewport:{width:1400,height:1000}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.join(__dirname,'..',file)).href);
   const title=await page.locator('.brand').boundingBox(),icon=await page.locator('#openHelp').boundingBox();
   assert.ok(icon.x>=title.x+title.width);
   await page.click('#maximize');await page.click('#openHelp');
   assert.ok(await page.locator('#helpDialog').isVisible());
   await page.keyboard.press('Escape');
   assert.ok(await page.locator('#helpDialog').isHidden());
   assert.ok(await page.locator('body').evaluate(e=>e.classList.contains('preview-max')));
   assert.equal(await page.evaluate(()=>document.activeElement.id),'openHelp');
   await page.click('#openHelp');
   // Modal key events must not reach the editor's document-level shortcuts.
   await page.evaluate(()=>{window.helpKeys=0;document.addEventListener('keydown',()=>window.helpKeys++);});
   await page.keyboard.press('ArrowRight');await page.keyboard.press('Control+z');
   assert.equal(await page.evaluate(()=>window.helpKeys),0);
   await page.click('a[href="#help-trouble"]');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'help-trouble');
   assert.ok(await page.locator('.help-body').evaluate(e=>e.scrollTop>0));
   await page.click('#closeHelp');await page.click('#maximize');
   await page.setViewportSize({width:390,height:700});
   await page.click('#openHelp');
   const box=await page.locator('#helpDialog').boundingBox();
   assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=700);
   assert.ok(await page.locator('.help-body').evaluate(e=>e.scrollWidth<=e.clientWidth));
   await page.screenshot({path:path.join(process.env.TEMP||'.','dotsnap-help-mobile.png')});
   await page.click('#closeHelp');assert.deepEqual(errors,[]);
   await page.close();console.log(file+': help navigation, shortcuts, focus and mobile layout passed');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
