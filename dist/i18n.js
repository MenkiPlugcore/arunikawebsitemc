'use strict';
(() => {
 const dictionaries=window.ARUNIKA_TRANSLATIONS;
 const names={'id':'Bahasa Indonesia','en':'English','ja':'日本語','es':'Español','ar':'العربية','th':'ไทย','vi':'Tiếng Việt','ms':'Bahasa Melayu','ko':'한국어','zh-TW':'繁體中文'};
 let saved='id';try{saved=localStorage.getItem('arunika-language')||'id'}catch{}
 let language=Object.hasOwn(names,saved)?saved:'id';
 const snapshots=[],attributes=[];
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){const node=walker.currentNode,source=node.textContent.trim();if(Object.hasOwn(dictionaries.id,source)&&!['SCRIPT','STYLE','OPTION'].includes(node.parentElement.tagName))snapshots.push({node,source,leading:node.textContent.match(/^\s*/)[0],trailing:node.textContent.match(/\s*$/)[0]});}
 document.querySelectorAll('[aria-label],[alt],[title]').forEach(node=>{for(const name of ['aria-label','alt','title']){const source=node.getAttribute(name);if(source&&Object.hasOwn(dictionaries.id,source))attributes.push({node,name,source})}});
 window.t=source=>dictionaries[language][source]??source;
 window.arunikaLocale=()=>language==='id'?'id-ID':language==='zh-TW'?'zh-TW':language;
 const select=document.querySelector('#language-select');
 for(const [code,name] of Object.entries(names)){let option=document.createElement('option');option.value=code;option.textContent=name;option.lang=code;select.append(option)}
 function apply(){
  document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';select.value=language;select.setAttribute('aria-label',t('Bahasa'));
  for(const {node,source,leading,trailing} of snapshots)if(node.isConnected)node.textContent=leading+t(source)+trailing;
  for(const {node,name,source} of attributes)if(node.isConnected)node.setAttribute(name,t(source));
  document.title=t('ARUNIKA — Your next adventure');
  document.querySelector('meta[name="description"]').content=t('Selamat datang di ARUNIKA. Tempat petualangan, kreativitas, dan komunitas bertemu dalam satu dunia Minecraft.');
  if(window.refreshLocale)window.refreshLocale();
 }
 select.addEventListener('change',()=>{language=Object.hasOwn(names,select.value)?select.value:'id';try{localStorage.setItem('arunika-language',language)}catch{}apply()});
 apply();
})();
