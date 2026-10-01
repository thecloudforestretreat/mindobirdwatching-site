from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent
source=ROOT/'vendor/editor-source.html'
s=source.read_text()
s=s.replace('      let reviewedEmail = null;', '      let reviewedEmail = null;\n      let pilotCustomBlocks = [];')
s=s.replace('return ensureRequiredBlocks(window.MBW_EMAIL_BLOCKS || buildDefaultCatalog());', 'const catalog=ensureRequiredBlocks(window.MBW_EMAIL_BLOCKS || buildDefaultCatalog()); return {...catalog,blocks:[...catalog.blocks,...pilotCustomBlocks]};')
s=re.sub(r'<script[^>]+src="([^"]+)"[^>]*></script>',lambda m:m.group(0) if any(x in m[1] for x in ['site-config.js','email-blocks.js']) else '',s)
s=s.replace('            loadReviewSummary();','            window.parent.postMessage({type:"pilot-ready"}, location.origin);')
s=s.replace('            applyCrmHandoff();','            state.selected = new Set(); state.order = []; renderBlockControls();')
s=s.replace('renderReadyCta(brand, nextSteps),', 'renderReadyCta(brand, getLanguage() === "es" ? "Si tienes alguna pregunta, responde a este correo o escríbenos por WhatsApp usando el botón de abajo." : "If you have any questions feel free to reply to this email or message us via WhatsApp with the button below."),')
s=s.replace('Pricing / text overrides', 'Edit prices / details')
s=s.replace('Price override</label>', 'Price for this email</label>')
s=s.replace('Private / note override</label>', 'Private price / note for this email</label>')
s=s.replace('Use presets first, then adjust blocks and pricing overrides only where needed.', 'To change a price: select the tour or activity, open Edit prices / details, and enter the price for this email. Blank fields use the catalog default shown as a hint. Save draft locally to keep your edits. These changes do not update your main price catalog.')
s=s.replace('<title>MBW Admin | Custom Email Generator</title>','<title>MBW Pilot | Draft Editor</title>')
s=s.replace('<style>','<style>\n.adminGlobalNav,#siteHeader,#siteFooter,.adminTop a[href="/"]{display:none!important} .shell{max-width:none!important} .pilotCustom{background:#fff8db;padding:12px;border-radius:12px;margin:12px 0} ',1)
s=s.replace('<div class="blockGroups" id="blockGroups"></div>','''<div class="pilotCustom"><strong>Add another item</strong>
<label>Item name<input id="pilotItemTitle" placeholder="Extra activity or service"></label>
<label>Details<textarea id="pilotItemDetails" placeholder="Describe what you want to offer"></textarea></label>
<label>Price / terms<input id="pilotItemPrice" placeholder="Enter only the amount or terms you reviewed"></label>
<button type="button" id="pilotAddItem">Add to this draft</button></div>
<div class="blockGroups" id="blockGroups"></div>''')
s=s.replace('      function bindEvents(){','''      function bindEvents(){
        document.getElementById("pilotAddItem").addEventListener("click",()=>{
          const title=document.getElementById("pilotItemTitle").value.trim();
          if(!title) return showToast("Add an item name first");
          const id="pilot-custom-"+Date.now();
          pilotCustomBlocks.push({id,group:"activities",type:"feature",title,description:document.getElementById("pilotItemDetails").value,price:document.getElementById("pilotItemPrice").value});
          state.selected.add(id); state.order.push(id);renderBlockControls();updateEmail();
          ["pilotItemTitle","pilotItemDetails","pilotItemPrice"].forEach(i=>document.getElementById(i).value="");
        });''',1)
bridge='''
      const PILOT_FIELDS=["guestNameInput","guestCountInput","datesInput","languageInput","introInput","directAnswerInput","nextStepsInput","heroEyebrowInput","emailWhatsappNumberInput","videoUrlInput","videoTitleInput","videoIntroInput"];
      let pilotInquiryId="";
      window.addEventListener("message",event=>{
        if(event.origin!==location.origin || event.source!==window.parent)return;
        const m=event.data||{};
        if(m.type==="pilot-save-request"){
          const fields=Object.fromEntries(PILOT_FIELDS.map(id=>[id,els[id].value]));
          const draft={fields,title:els.emailTitleInput.value,selected:[...state.selected],order:state.order,groupOrder:state.groupOrder,overrides:state.overrides,showHero:els.showHeroInput.checked,compact:els.compactCardsInput.checked,video:els.videoWeekInput.checked,customBlocks:getCatalog().blocks.filter(b=>b.id.startsWith("pilot-custom-")),html:els.htmlOutput.value};
          window.parent.postMessage({type:"pilot-save",inquiry_id:pilotInquiryId,draft},location.origin);return;
        }
        if(m.type!=="pilot-load")return;
        pilotInquiryId=m.inquiry.inquiry_id;
        reviewedEmail=null; pilotCustomBlocks=[];
        if(m.saved){
          const d=m.saved;
          if(Array.isArray(d.customBlocks)) pilotCustomBlocks.push(...d.customBlocks.filter(b=>String(b.id).startsWith("pilot-custom-")));
          for(const id of PILOT_FIELDS)if(d.fields&&typeof d.fields[id]==="string")els[id].value=d.fields[id];
          setEmailTitle(d.title||"Tour options");
          state.selected=new Set(d.selected||[]);state.order=d.order||[];state.groupOrder=d.groupOrder||defaultGroupOrder();state.overrides=d.overrides||{};
          els.showHeroInput.checked=!!d.showHero;els.compactCardsInput.checked=!!d.compact;els.videoWeekInput.checked=!!d.video;
        }else{
          const d=m.draft||{},r=m.inquiry;
          els.languageInput.value=d.language||"en";applyLanguageDefaults();
          els.guestNameInput.value=r.full_name||r.first_name||"";
          els.guestCountInput.value=r.guest_count||"";
          els.datesInput.value=r.requested_date_text||r.requested_date_start||"";
          setEmailTitle(d.title||"Your Mindo tour options");
          els.directAnswerInput.value=d.direct_answer||"";
          els.introInput.value="";
          els.nextStepsInput.value=d.next_steps||(d.language==="es"?"Cuéntanos si deseas ajustar alguna opción.":"Let us know if you would like to adjust any of these options.");
          state.selected=new Set(d.block_ids||[]);state.order=[...state.selected];state.groupOrder=defaultGroupOrder();state.overrides={};
        }
        renderBlockControls();updateEmail();
      });
'''
s=s.replace('    })();\n  </script>',bridge+'\n    })();\n  </script>')
s=s.replace('        syncPricingReview();\n        const videoUrl', '        syncPricingReview();\n        window.parent.postMessage({type:"pilot-changed"},location.origin);\n        const videoUrl')
(ROOT/'public/editor.html').write_text(s)
