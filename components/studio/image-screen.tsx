import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionButton, Notice } from '@/components/crop/ui';
import { useBilling } from '@/lib/billing/store';
import type { BatchResult } from '@/lib/crop/types';
import { DEFAULT_IMAGE_SETTINGS, validateImageSettings, type ImageLabSettings } from '@/lib/studio/rules';
import { transformImage, supportsContain } from '@/lib/studio/images';
import { StudioScreen, Field, Options, Toggle, studioStyles } from './ui';
import { StudioSources, useStudioSources } from './sources';

export default function ImageScreen(){
  const state=useStudioSources();const billing=useBilling();const router=useRouter();
  const [settings,setSettings]=useState<ImageLabSettings>({...DEFAULT_IMAGE_SETTINGS});
  const [width,setWidth]=useState(String(DEFAULT_IMAGE_SETTINGS.width));const [height,setHeight]=useState(String(DEFAULT_IMAGE_SETTINGS.height));
  const [busy,setBusy]=useState(false);const [progress,setProgress]=useState(0);const [message,setMessage]=useState<string|null>(null);
  const stop=useRef(false);const locked=useRef(false);const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop.current=true;};},[]);
  const current={...settings,width:Number(width),height:Number(height)};
  const invalid=validateImageSettings(current);
  async function prepare(){
    if(locked.current||!state.selected.length||invalid)return;
    const sources=state.selected.map(source=>({...source}));const frozen={...current};
    locked.current=true;stop.current=false;setBusy(true);setProgress(0);setMessage(null);
    try{
      if(!(await billing.authorizeBatch(sources.length))){router.push('/pro');return;}
      if(stop.current)return;
      const batch:BatchResult={id:`lab-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,createdAt:Date.now(),outputs:[],errors:[],cancelled:false,total:sources.length};
      for(let index=0;index<sources.length;index++){
        if(stop.current){batch.cancelled=true;break;}
        try{batch.outputs.push(await transformImage(sources[index],frozen,batch.id,index,sources.length));}
        catch(error){batch.errors.push({name:sources[index].name,message:error instanceof Error?error.message:'Image preparation failed.'});}
        if(mounted.current)setProgress(index+1);
      }
      if(batch.outputs.length||batch.errors.length){state.crop.openBatch(batch);if(mounted.current)router.push('/exports');}
    }catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:'Image preparation failed.');}
    finally{locked.current=false;if(mounted.current)setBusy(false);}
  }
  return <StudioScreen title="Image Lab" subtitle="Resize or convert new copies for sharing and design. Keep every detail with Fit inside, or choose an exact padded frame. Originals never change.">
    <StudioSources state={state} disabled={busy}/>
    <View style={studioStyles.panel}><Text style={studioStyles.label}>02 / PREPARE YOUR COPIES</Text>
      <View style={studioStyles.row}><Field label="Target width (px)" value={width} onChange={setWidth} numeric disabled={busy}/><Field label="Target height (px)" value={height} onChange={setHeight} numeric disabled={busy}/></View>
      <Options label="Sizing" value={settings.fit} options={[{id:'inside',title:'Fit inside · keep all'},...(supportsContain?[{id:'contain' as const,title:'Exact frame · pad'}]:[]),{id:'cover',title:'Fill frame · crop edges'}]} onChange={fit=>setSettings(old=>({...old,fit}))} disabled={busy}/>
      <Text style={studioStyles.copy}>{settings.fit==='inside'?'Fits within the target box while preserving aspect ratio and all content. Output dimensions can be smaller.':settings.fit==='contain'?'Keeps the entire image and adds a background to fill the exact frame.':'Intentional edge crop: fills the exact frame. Use Fit inside to preserve all content.'} Resizing does not recover unreadable text or add AI detail.</Text>
      <Toggle label="Allow enlarging smaller source images" checked={settings.allowUpscale} onChange={()=>setSettings(old=>({...old,allowUpscale:!old.allowUpscale}))} disabled={busy}/>
      <Options label="Output format" value={settings.format} options={[{id:'png',title:'PNG · sharp/lossless'},{id:'jpeg',title:'JPEG · smaller file'}]} onChange={format=>setSettings(old=>({...old,format}))} disabled={busy}/>
      {settings.format==='jpeg'?<Options label="JPEG quality" value={String(settings.quality)} options={[{id:'0.95',title:'95% · readable text'},{id:'1',title:'100% · maximum detail'}]} onChange={quality=>setSettings(old=>({...old,quality:Number(quality)}))} disabled={busy}/>:null}
      {supportsContain?<Options label="Background for padding/transparency" value={settings.background} options={[{id:'white',title:'White'},{id:'black',title:'Black'}]} onChange={background=>setSettings(old=>({...old,background}))} disabled={busy}/>:null}
      <Text style={studioStyles.copy}>Targets up to 8192 px per side / 32 megapixels. PNG keeps transparency when no padded frame is selected. JPEG stays at 95%+ quality; native transparent-PNG flattening needs a pre-flattened source or the web edition.</Text>
      {invalid?<Notice message={invalid} error/>:null}{message?<Notice message={message} error/>:null}
      {busy?<><Text style={studioStyles.copy}>Prepared {progress}/{state.selected.length}. Successful copies stay in input order.</Text><ActionButton title="Stop after current image" secondary onPress={()=>{stop.current=true;}}/></>:<ActionButton title={`Prepare ${state.selected.length} image${state.selected.length===1?'':'s'}`} icon="resize-outline" onPress={()=>void prepare()} disabled={!state.selected.length||!!invalid||state.crop.processing||state.crop.picking}/>}
    </View>
  </StudioScreen>;
}
