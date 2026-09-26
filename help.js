/* In-app manual, shared by the development and standalone editions. */
(function(){
'use strict';
const brand=document.querySelector('.controls .brand');
const heading=document.createElement('div');
heading.className='brand-heading';
brand.before(heading);heading.append(brand);
const opener=document.createElement('button');
opener.type='button';opener.id='openHelp';opener.className='help-button';
opener.title='ヘルプ・マニュアル';opener.setAttribute('aria-label','ヘルプ・マニュアルを開く');
opener.setAttribute('aria-haspopup','dialog');opener.setAttribute('aria-controls','helpDialog');
opener.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.8-2.5 2-2.5 3.5"/><path d="M12 16h.01"/></svg>';
heading.append(opener);
const dialog=document.createElement('dialog');dialog.id='helpDialog';dialog.setAttribute('aria-labelledby','helpTitle');
dialog.innerHTML=`
<header class="help-header"><div><span class="eyebrow">DOTSNAP GUIDE</span><h1 id="helpTitle">ヘルプ・マニュアル</h1></div><button type="button" id="closeHelp" aria-label="ヘルプを閉じる" autofocus>閉じる <span aria-hidden="true">×</span></button></header>
<div class="help-body">
<p class="help-lead">画像を整えて、1ドットずつ仕上げる。</p>
<p>dotsnapは、イラストやスプライトシートを指定サイズ・色数のドット絵に整えるツールです。画像と設定はブラウザ内で処理し、外部に送信しません。</p>
<nav class="help-nav" aria-label="マニュアルの目次"><a href="#help-start">はじめに</a><a href="#help-settings">変換設定</a><a href="#help-preview">確認・比較</a><a href="#help-edit">手仕上げ</a><a href="#help-save">保存・出力</a><a href="#help-keys">キー操作</a><a href="#help-trouble">困ったとき</a></nav>
<section id="help-start"><h2>まずは、この5ステップ</h2><ol>
<li><strong>画像を開く。</strong>「画像を開く」、ドラッグ＆ドロップ、Ctrl+Vの貼り付けに対応。「デモ」でも試せます。</li>
<li><strong>大きさと色数を決める。</strong>コマサイズ・最大色数を指定。まずは「全体を収める」と自動補修の「おまかせで選ぶ」を試します。</li>
<li><strong>背景とコマを調整する。</strong>一枚絵なら「一枚のイラスト」、シートなら自動分割か列・行の等分割を選びます。</li>
<li><strong>見比べて仕上げる。</strong>3つの候補と「補修前 / 後」を確認。細かな修正は「確定して手仕上げへ」から行います。</li>
<li><strong>PNGを書き出す。</strong>続きから編集したいときは「作業を保存」も使ってください。</li>
</ol></section>
<section id="help-settings"><h2>変換設定の使い方</h2>
<h3>01 仕上がりを決める</h3><p>コマサイズは幅・高さそれぞれ8〜512px、最大色数は透明を除く2〜256色です。「全体を収める」は絵が枠に収まるように調整し、「密度を維持して切り出す」はドットの密度を優先して枠外を切り取ります。</p>
<h3>02 自動で仕上げる</h3><p>スイッチで自動補修をON/OFF。「縁だけ」は透明部分との境界、「全体（縁＋内側）」は内側の小さな特徴も対象です。「原画に忠実」「細部をくっきり」「すっきり整理」を比較できます。生成AIではなく元画像の色と形を参照する処理のため、失われた細部を必ず復元できるわけではありません。</p>
<h3>03 背景とコマ</h3><dl>
<dt>背景を抜く</dt><dd>透明画像は「元の透明を使う」。外側の背景だけなら「外周につながる色を抜く」、囲まれた部分も同じ色で抜くなら「指定色を全体から抜く」を選びます。「色による除去なし」は色を理由に背景を抜きません。</dd>
<dt>指定色・追加色・許容範囲</dt><dd>「元画像から選ぶ」で抜く色を取得できます。指定色を変更すると全体から抜くモードになります。「抜く色をスポイトで追加」で最大32色を追加でき、追加色をクリックすると解除します。許容範囲を上げるほど近い色も抜け、上限442では全色が対象になります。</dd>
<dt>暗い抜き色・縁の色かぶりを除去</dt><dd>暗い同系色の抜き残しと、輪郭に混ざった抜き色を補正します。衣装など必要な同系色も消える場合はOFFにしてください。</dd>
<dt>コマ分割</dt><dd>「空白から自動」は余白を手がかりに分割。「列・行で等分割」は列数と行数を指定。「範囲を手動指定」は「元画像」上をドラッグして順にコマを追加し、「範囲をクリア」で全解除できます。</dd>
<dt>余白・格子・配置</dt><dd>外周余白とコマ間隔を調整できます。ドット密度は全コマ共通・コマごとの推定、出力サイズ合わせ、手動ピッチから選択。配置は元の相対位置を保持するか、コマごとの下中央・中央へ揃えます。</dd></dl>
<h3>04 色と輪郭</h3><p>「残したい色」に <code>#ffcc99 #304c8c</code> のように色を指定すると自動パレットに含めます。共通パレットの色をクリックしても追加できます。「固定パレット」は入力した色だけを使い、最大色数より優先します。縁線は内側・外側に1ドット追加でき、固定パレット使用時はその中の近い色になります。</p></section>
<section id="help-preview"><h2>確認・比較する</h2><ul>
<li><strong>仕上がり / 補修前 / 後 / 元画像：</strong>タブで表示を切り替えます。比較表示ではドラッグとスクロールが左右で連動します。</li>
<li><strong>コマ枠・ドット格子：</strong>コマ単位と1ドット単位の境界を表示。「補修箇所」「点滅」で変更された場所を確認できます。これらの表示はPNGに入りません。</li>
<li><strong>倍率・表示領域：</strong>倍率メニューで拡大。プレビュー下端のハンドルで高さを変更でき、「プレビューを最大化」で広げられます。</li>
<li><strong>コマと動き：</strong>コマを選び、横・縦で位置を補正。「動きを確認」で再生する行とfpsを選びます。「前のコマ」は直前のコマを重ねて確認する表示です。</li>
</ul></section>
<section id="help-edit"><h2>1ドットずつ手仕上げする</h2><p>「確定して手仕上げへ」で変換結果とパレットを確定します。左のコマ選択とパレットから編集対象・色を選び、「仕上がり」タブの画像をクリック／ドラッグして描きます。</p><ul>
<li><strong>ペン / 消しゴム / スポイト：</strong>道具を選択。ペン中はShiftで一時消去、Altで色を取得でき、両方押すとAltを優先します。</li>
<li><strong>絵を移動：</strong>矢印ボタンまたは矢印キーで1ドット移動。枠サイズは固定です。枠外の画素も作業データに残るので、戻す方向に移動すれば再び表示できます。</li>
<li><strong>確認とやり直し：</strong>「確定時 / 手仕上げ」で比較。「手修正を反映」をOFFにすると閲覧用の確定時表示になり、描画・移動はできません。書き出しには常に手修正が反映されます。「このコマの修正をリセット」で確定時に戻せます。</li>
</ul><p class="help-note">「変換設定に戻る」と手仕上げは破棄されます。残したい場合は先に「作業を保存」してください。</p></section>
<section id="help-save"><h2>作業を保存・素材を書き出す</h2><dl>
<dt>作業を保存 / 再開</dt><dd>画像・設定・コマ範囲・位置補正を <code>.dotsnap</code> ファイルに保存。「再開」で読み戻せます。手仕上げ中は確定画像・パレット・枠外の画素も保存します。戻す／やり直すの操作履歴は再開時に引き継ぎません。</dd>
<dt>PNGを書き出す</dt><dd>全コマを並べたスプライトシートを出力します。透明度は透明または不透明の2段階です。</dd>
<dt>選択コマ PNG / 全コマ ZIP</dt><dd>選択した1コマ、または各コマを個別PNGにしたZIPを出力します。</dd>
<dt>コマ情報JSON / パレットのコピー</dt><dd>コマ情報をJSONで保存したり、色の一覧をコピーできます。作業の再開には「作業を保存」で作ったファイルを使います。</dd></dl></section>
<section id="help-keys"><h2>キーボード操作</h2><p>MacではCtrlの代わりにCommandを使えます。文字・数値の入力中は入力欄の操作が優先されます。</p><div class="help-table-wrap"><table><thead><tr><th scope="col">操作</th><th scope="col">キー</th></tr></thead><tbody>
<tr><td>画像を貼り付け</td><td>Ctrl + V</td></tr><tr><td>戻す / やり直す</td><td>Ctrl + Z / Ctrl + Shift + Z または Ctrl + Y</td></tr><tr><td>手仕上げの拡大 / 縮小</td><td>＋（＝）/ −、Ctrl + ホイール</td></tr><tr><td>手仕上げの絵を1ドット移動</td><td>矢印キー</td></tr><tr><td>ペン中に消去 / 色を取得</td><td>Shift / Alt + クリック・ドラッグ</td></tr><tr><td>プレビューの高さを変更</td><td>下端ハンドルにフォーカスして ↑ / ↓</td></tr><tr><td>ヘルプを閉じる / 最大化を解除</td><td>Esc（ヘルプが開いている間はヘルプだけ閉じます）</td></tr></tbody></table></div></section>
<section id="help-trouble"><h2>困ったとき</h2><dl>
<dt>必要な色まで透明になる</dt><dd>許容範囲を下げ、指定色・追加色を確認します。同系色の衣装などが消える場合は色かぶり除去をOFFに。内側の色を残したいときは「外周につながる色を抜く」を試します。</dd>
<dt>コマがうまく分かれない</dt><dd>一枚絵は「一枚のイラスト」に。シートは列・行の等分割や手動範囲指定を使い、余白と間隔も確認します。</dd>
<dt>絵が切れる・小さすぎる</dt><dd>コマサイズと枠への収め方、ドット密度、位置補正を確認します。全体を残すなら「全体を収める」を選んでください。</dd>
<dt>手仕上げで描けない</dt><dd>「仕上がり」タブと「手修正を反映」がONか確認し、パレットから色を選びます。比較表示はドラッグによる閲覧用です。</dd>
<dt>画像を読み込めない・処理が重い</dt><dd>入力はPNG / JPEG / WebPなどブラウザで読める画像で、1600万画素まで。出力は合計800万画素・シートの一辺16384pxまでです。画像を小さくするか、出力サイズやコマ数を減らしてください。</dd>
</dl></section>
</div>`;
document.body.append(dialog);
opener.addEventListener('click',()=>dialog.showModal());
dialog.querySelector('#closeHelp').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>opener.focus());
// Keep editing shortcuts and image imports from changing the work behind the manual.
dialog.addEventListener('keydown',e=>e.stopPropagation());
dialog.addEventListener('keyup',e=>e.stopPropagation());
dialog.addEventListener('paste',e=>e.stopPropagation());
for(const event of ['dragenter','dragover','dragleave','drop'])dialog.addEventListener(event,e=>{e.preventDefault();e.stopPropagation();});
dialog.querySelectorAll('.help-nav a').forEach(link=>link.addEventListener('click',e=>{
 e.preventDefault();const section=dialog.querySelector(link.getAttribute('href'));
 section.scrollIntoView({block:'start'});section.tabIndex=-1;section.focus({preventScroll:true});
}));
})();
