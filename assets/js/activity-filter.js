(function(){
 "use strict";
 var controls=document.querySelector('[data-activity-filters]');
 if(!controls)return;
 var cards=Array.from(document.querySelectorAll('.activityHubCard[data-activity-categories]'));
 var buttons=Array.from(controls.querySelectorAll('[data-activity-filter]'));
 var count=controls.querySelector('[data-activity-count]');
 function apply(value){
  var visible=0;
  cards.forEach(function(card){card.hidden=value!=='all'&&card.dataset.activityCategories.split(' ').indexOf(value)===-1;if(!card.hidden)visible++;});
  buttons.forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.activityFilter===value));});
  count.textContent=document.documentElement.lang.indexOf('es')===0?visible+' de '+cards.length+' actividades':visible+' of '+cards.length+' activities';
 }
 buttons.forEach(function(button){button.addEventListener('click',function(){apply(button.dataset.activityFilter);});});
 controls.hidden=false;apply('all');
})();
