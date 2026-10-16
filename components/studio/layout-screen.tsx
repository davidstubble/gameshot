import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionButton, Notice } from '@/components/crop/ui';
import { useBilling } from '@/lib/billing/store';
import type { BatchResult } from '@/lib/crop/types';
import { DEFAULT_LAYOUT_SETTINGS, validateLayoutSettings, type LayoutSettings } from '@/lib/studio/rules';
import { makeContactSheet, sourceAsJpeg, downloadPdf, supportsContactSheet } from '@/lib/studio/images';
import { createLayoutPdf } from '@/lib/studio/pdf';
import { StudioScreen, Field, Options, Toggle, studioStyles } from './ui';
import { StudioSources, useStudioSources } from './sources';

export default function LayoutScreen(){
  const state=useStudioSources();const billing=useBilling();const router=useRouter();
  const [settings,setSettings]=useState<LayoutSettings>({...DEFAULT_LAYOUT_SETTINGS});
  const [busy,setBusy]=useState(false);const [progress,setProgress]=useState(0);const [message,setMessage]=useState<string|null>(null);
  const [kind,setKind]=useState<'pdf'|'sheet'>('pdf');const stop=useRef(false);const locked=useRef(false);const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop.current=true;};},[]);
  const invalid=validateLayoutSettings(settings);
  async function create(){
    if(locked.current||invalid||!state.selected.length)return;
    const sources=state.selected.map(source=>({...source}));const frozen={...settings};const mode=kind;
    locked.current=true;stop.current=false;setBusy(true);setProgress(0);setMessage(null);
    try{
      if(!(await billing.authorizeBatch(sources.length))){router.push('/pro');return;}
      if(stop.current)return;
      if(mode==='sheet'){
        const id=`sheet-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
        const output=await makeContactSheet(sources,frozen,id);
        const batch:BatchResult={id,createdAt:Date.now(),outputs:[output],errors:[],cancelled:false,total:sources.length};
        state.crop.openBatch(batch);if(mounted.current)router.push('/exports');
      }else{
        if(sources.length>100)throw new Error('Choose up to 100 images for one PDF. Split larger albums into several documents.');
        const prepared:{name:string;bytes:Uint8Array;width:number;height:number}[]=[];
        let bytes=0;
        for(let index=0;index<sources.length;index++){
          if(stop.current)throw new Error('PDF preparation stopped. No incomplete PDF was downloaded. Your source images are unchanged.');
          const image=await sourceAsJpeg(sources[index],3000,3000);bytes+=image.bytes.byteLength;
          if(bytes>128*1024*1024)throw new Error('This PDF selection exceeds the 128 MB preparation limit. Choose fewer images.');
          prepared.push({...image,name:sources[index].name});if(mounted.current)setProgress(index+1);
        }
        if(stop.current)throw new Error('PDF preparation stopped. Your originals are unchanged.');
        const pdf=await createLayoutPdf(prepared,frozen);
        if(stop.current)return;
        const name=`GameShot-LABS-${Date.now()}.pdf`;await downloadPdf(pdf,name);
        if(mounted.current)setMessage(`PDF prepared: ${name}. Browser: find it in Downloads. Phone app: choose Files or another destination in the share sheet. No images were uploaded.`);
      }
    }catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:'Layout could not be created. No source files were changed.');}
    finally{locked.current=false;if(mounted.current)setBusy(false);}
  }
  return <StudioScreen title="Layout Lab" subtitle="Build reference albums, research boards and storyboards from your chosen image order. Export a real PDF for print/design handoff, or an overview contact sheet.">
    <StudioSources state={state} disabled={busy}/>
    <View style={studioStyles.panel}><Text style={studioStyles.label}>02 / BUILD YOUR LAYOUT</Text>
      <Options label="Output" value={kind} options={[{id:'pdf',title:'Multi-page PDF'},...(supportsContactSheet?[{id:'sheet' as const,title:'Contact sheet image'}]:[])]} onChange={setKind} disabled={busy}/>
      {!supportsContactSheet?<Text style={studioStyles.copy}>Contact-sheet image generation is available in the browser edition. Multi-page PDF is available here.</Text>:null}
      <Options label="Page size" value={settings.paper} options={[{id:'a4',title:'A4'},{id:'letter',title:'US Letter'}]} onChange={paper=>setSettings(old=>({...old,paper}))} disabled={busy}/>
      <Options label="Orientation" value={settings.orientation} options={[{id:'portrait',title:'Portrait'},{id:'landscape',title:'Landscape'}]} onChange={orientation=>setSettings(old=>({...old,orientation}))} disabled={busy}/>
      <Options label="Columns" value={String(settings.columns)} options={[{id:'1',title:'1 · larger detail'},{id:'2',title:'2 · overview'},{id:'3',title:'3 · contact sheet'}]} onChange={columns=>setSettings(old=>({...old,columns:Number(columns)}))} disabled={busy}/>
      <Field label="Optional document title" value={settings.title} onChange={title=>setSettings(old=>({...old,title}))} disabled={busy}/>
      <Toggle label="Include ordered filenames as captions" checked={settings.captions} onChange={()=>setSettings(old=>({...old,captions:!old.captions}))} disabled={busy}/>
      <Text style={studioStyles.copy}>Tiny text? Use one column and cropped detail images; a dense contact sheet is for overview, not reading. No upscaling, OCR or new details are invented. PDFs use prepared JPEG copies up to 3000 px per side and paginate in selected order.</Text>
      <Text style={studioStyles.copy}>{kind==='pdf'?'Up to 100 images / 128 MB prepared image data.':'Up to 12 images per contact sheet.'} Original files are never changed. Open the downloaded PDF in your normal print dialog; this tool does not send files to a printer.</Text>
      {invalid?<Notice message={invalid} error/>:null}{message?<Notice message={message}/>:null}
      {busy?<><Text style={studioStyles.copy}>Preparing {progress}/{state.selected.length} in selected order…</Text><ActionButton title="Stop after current operation" secondary onPress={()=>{stop.current=true;}}/></>:<ActionButton title={kind==='pdf'?'Create and download PDF':'Create contact sheet'} icon="document-outline" onPress={()=>void create()} disabled={!state.selected.length||!!invalid||state.crop.processing||state.crop.picking||(kind==='sheet'&&state.selected.length>12)}/>}
    </View>
  </StudioScreen>;
}
